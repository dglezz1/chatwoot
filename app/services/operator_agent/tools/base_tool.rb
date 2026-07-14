require 'agents'

# Base class for all Operator Agent tools.
#
# Unlike Captain::Tools::BasePublicTool (which is bound to a single
# Captain assistant and operates inside a customer conversation),
# Operator Agent tools are bound to an account + the operator who is
# chatting. They can read and write any account-scoped resource:
# inboxes, contacts, agents, teams, labels, automation rules, etc.
#
# Confirmation flow (Phase 2+):
# - Subclass declares `def self.destructive? = true`
# - First time the LLM calls the tool, the tool returns a
#   `pending(...)` hash instead of executing
# - The executor persists a PendingAction row and tells the LLM to
#   ask the operator to confirm
# - The operator hits "Confirm" in the UI; the controller sets
#   `tool_context.state[:confirmed_action_id]` and re-invokes the tool
# - The tool sees the flag and runs the real action
#
# This is the standard two-phase commit pattern for destructive ops:
# the LLM proposes, the human disposes.
class OperatorAgent::Tools::BaseTool < Agents::Tool
  # Override in subclasses to declare the tool as destructive.
  # Destructive tools return a pending_action hash on first call.
  def self.destructive?
    false
  end

  def initialize(account:, user:)
    @account = account
    @user = user
    super()
  end

  def active?
    true
  end

  # Tools requiring an `administrator` role return ['administrator'].
  # Read-only tools return ['administrator', 'agent'].
  def permissions
    ['administrator', 'agent']
  end

  protected

  def account_scoped(model_class)
    model_class.where(account_id: @account.id)
  end

  def log_tool_usage(action, details = {})
    Rails.logger.info do
      "#{self.class.name}: #{action} for account #{@account.id} user #{@user.id} - #{details.inspect}"
    end
  end

  # True if the tool is being invoked after the operator confirmed a
  # pending action. Subclasses use this to branch between "propose"
  # and "execute".
  def confirmed?(tool_context)
    tool_context&.state&.dig(:confirmed_action_id).present?
  end

  def ok(content, metadata: {})
    content.to_s
  end

  # Persist a pending action and return the marker string for the LLM.
  # The agents gem (ai-agents 0.12) doesn't surface tool return values
  # in the tool_calls hash, so the executor can't see our PENDING_ACTION
  # marker. Instead, the tool writes the row directly. The marker
  # string still goes back to the LLM as the tool's return value so
  # the LLM can tell the operator "Action queued — confirm in the UI".
  def pending(tool_name, tool_args, summary, message: nil)
    # The tool runs in the executor's context. The executor passes
    # @user_message implicitly via the instance variables already set
    # in perform. We need the assistant message to attach the
    # pending action to. The tool_context may carry a pending_message
    # reference; if not, we defer to the executor to create the row
    # via a thread-local queue.
    payload = JSON.dump(tool_name: tool_name.to_s, tool_args: tool_args.stringify_keys, summary: summary.to_s)

    # Queue the pending action via thread-local; the executor drains
    # the queue at the end of run_with_tools and persists the rows.
    OperatorAgent::Tools::BaseTool.pending_queue << {
      tool_name: tool_name.to_s,
      tool_args: tool_args.stringify_keys,
      summary: summary.to_s
    }

    "PENDING_ACTION|#{payload}\n#{summary}"
  end

  def err(message)
    "ERROR: #{message}"
  end

  # Thread-local FIFO of pending action rows to be created by the
  # executor at the end of the run. Cleared after each run.
  def self.pending_queue
    Thread.current[:operator_agent_pending_queue] ||= []
  end

  def self.drain_pending_queue
    q = pending_queue
    Thread.current[:operator_agent_pending_queue] = []
    q
  end
end

