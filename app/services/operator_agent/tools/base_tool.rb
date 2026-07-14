require 'agents'

# Base class for all Operator Agent tools.
#
# Unlike Captain::Tools::BasePublicTool (which is bound to a single
# Captain assistant and operates inside a customer conversation),
# Operator Agent tools are bound to an account + the operator who is
# chatting. They can read and (in Phase 2+) write any account-scoped
# resource: inboxes, contacts, agents, teams, labels, automation
# rules, etc.
#
# A tool returns a String the LLM reads as the next user message,
# OR a Hash with a :pending_action key for destructive actions
# (Phase 2+).
class OperatorAgent::Tools::BaseTool < Agents::Tool
  # Override in subclasses to declare the tool as destructive.
  # Destructive tools return a pending_action hash; the operator
  # must confirm via the UI before the action actually runs.
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

  # Wraps a string result with metadata so the executor can record
  # it cleanly. Subclasses can return either a plain String or a Hash
  # with {content:, pending_action:, metadata:}.
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
