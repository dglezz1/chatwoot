class OperatorAgent::Tools::ReopenConversationTool < OperatorAgent::Tools::BaseTool
  description 'Reopen a previously resolved conversation. Non-destructive.'

  param :conversation_id, type: 'integer', desc: 'The ID of the conversation to reopen', required: true

  def perform(_tool_context, conversation_id:)
    conversation = account_scoped(Conversation).find_by(id: conversation_id)
    return err("Conversation ##{conversation_id} not found.") unless conversation

    if conversation.open?
      return ok("Conversation ##{conversation.display_id} ya estaba abierta.")
    end

    log_tool_usage('reopen_conversation', conversation_id: conversation.id)
    conversation.update!(status: :open)
    "✅ Conversación ##{conversation.display_id} reabierta."
  rescue StandardError => e
    err("Failed to reopen conversation: #{e.message}")
  end
end
