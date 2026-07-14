class OperatorAgent::Tools::AddLabelToConversationTool < OperatorAgent::Tools::BaseTool
  description 'Add a label to a conversation. Non-destructive.'

  param :conversation_id, type: 'integer', desc: 'The ID of the conversation', required: true
  param :label_name, type: 'string', desc: 'The name of the label (will be created if it does not exist)', required: true

  def perform(_tool_context, conversation_id:, label_name:)
    conversation = account_scoped(Conversation).find_by(id: conversation_id)
    return err("Conversation ##{conversation_id} not found.") unless conversation

    name = label_name.to_s.strip.downcase
    return err('Label name is required.') if name.blank?

    label = account_scoped(Label).find_or_create_by!(title: name) { |l| l.color = '#808080' }

    conversation.add_labels(name)

    log_tool_usage('add_label_to_conversation', conversation_id: conversation.id, label: name)
    "✅ Label '#{name}' añadida a la conversación ##{conversation.display_id}."
  rescue StandardError => e
    err("Failed to add label: #{e.message}")
  end
end
