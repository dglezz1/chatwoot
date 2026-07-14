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
    { content: content, metadata: metadata }.with_indifferent_access
  end

  def pending(tool_name, tool_args, summary)
    {
      pending_action: true,
      tool_name: tool_name,
      tool_args: tool_args,
      summary: summary
    }.with_indifferent_access
  end

  def err(message)
    { content: message, error: true }.with_indifferent_access
  end
end

