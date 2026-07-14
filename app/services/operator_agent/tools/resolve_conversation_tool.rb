class OperatorAgent::Tools::ResolveConversationTool < OperatorAgent::Tools::BaseTool
  description 'Resolve (close) a conversation. Marks status=resolved and adds a private note. Non-destructive (reversible via reopen_conversation).'

  param :conversation_id, type: 'integer', desc: 'The ID of the conversation to resolve', required: true
  param :note, type: 'string', desc: 'Optional internal note explaining why this is being resolved', required: false

  def perform(_tool_context, conversation_id:, note: nil)
    conversation = account_scoped(Conversation).find_by(id: conversation_id)
    return err("Conversation ##{conversation_id} not found.") unless conversation

    if conversation.resolved?
      return ok("Conversation ##{conversation.display_id} ya estaba resuelta.")
    end

    log_tool_usage('resolve_conversation', conversation_id: conversation.id, note: note)

    conversation.messages.create!(
      message_type: :outgoing,
      private: true,
      sender: @user,
      account: @account,
      inbox: conversation.inbox,
      content: note.presence || "Resuelto por el operador via Operator Agent."
    ) if note.present?

    conversation.update!(status: :resolved)

    "✅ Conversación ##{conversation.display_id} resuelta."
  rescue StandardError => e
    err("Failed to resolve conversation: #{e.message}")
  end
end
