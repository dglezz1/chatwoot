class OperatorAgent::Tools::AssignConversationTool < OperatorAgent::Tools::BaseTool
  description 'Assign a conversation to a specific agent. Non-destructive (can be reassigned).'

  param :conversation_id, type: 'integer', desc: 'The ID of the conversation', required: true
  param :agent_id, type: 'integer', desc: 'The user ID of the agent to assign to', required: true
  param :team_id, type: 'integer', desc: 'Optional team ID to also assign', required: false

  def perform(_tool_context, conversation_id:, agent_id:, team_id: nil)
    conversation = account_scoped(Conversation).find_by(id: conversation_id)
    return err("Conversation ##{conversation_id} not found.") unless conversation

    agent = @account.users.find_by(id: agent_id)
    return err("Agent #{agent_id} not found in this account.") unless agent

    unless agent.account_users.where(account_id: @account.id).exists?
      return err("User #{agent_id} is not a member of this account.")
    end

    log_tool_usage('assign_conversation', conversation_id: conversation.id, agent_id: agent_id, team_id: team_id)

    conversation.update!(assignee: agent, team_id: team_id)

    "✅ Conversación ##{conversation.display_id} asignada a @#{agent.name}#{team_id ? " (team ##{team_id})" : ''}."
  rescue StandardError => e
    err("Failed to assign conversation: #{e.message}")
  end
end
