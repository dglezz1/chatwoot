class CaptainListener < BaseListener
  include ::Events::Types

  # Fired on every incoming message in any conversation across the account.
  # Filters down to: incoming + non-private + non-empty + inbox has Captain.
  def message_created(event)
    message = event.data[:message]
    return if message.blank?
    return unless message.incoming?
    return if message.private
    return if message.content.blank?
    return unless message.inbox&.captain_active?
    # Defer to a background job to keep the request response fast.
    Captain::AutoReplyJob.perform_later(message.id)
  end

  def conversation_resolved(event)
    conversation = extract_conversation_and_account(event)[0]
    assistant = conversation.inbox.captain_assistant

    return unless conversation.inbox.captain_active?

    Captain::Llm::ContactNotesService.new(assistant, conversation).generate_and_update_notes if assistant.config['feature_memory'].present?
    Captain::Llm::ConversationFaqService.new(assistant, conversation).generate_and_deduplicate if assistant.config['feature_faq'].present?
  end
end
