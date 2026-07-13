module Enterprise::MessageTemplates::HookExecutionService
  MAX_ATTACHMENT_WAIT_SECONDS = 4

  # Master safety gate. Returns false for any inbound message that should
  # never trigger Captain V1 auto-reply. Called BOTH before scheduling the
  # job AND inside should_process_captain_response?. Add new guards here so
  # all paths converge on the same allow-list.
  #
  # IMPORTANT: This is the single source of truth. The original code had
  # separate checks scattered across multiple methods and the
  # handle_error path of ResponseBuilderJob, which caused V1 to spam
  # "Auto-handoff:" messages to every contact whenever the LLM call errored.
  # Every guard the auto-reply pipeline needs should live here.
  def captain_safe_to_respond?
    return false unless conversation.pending?
    return false unless message.incoming?
    return false if message.private
    return false if message.content.blank?
    return false unless inbox&.captain_assistant.present?
    return false if inbox&.name.blank?

    # Per-conversation pause: a human agent has explicitly handed the
    # thread off to themselves via the Bot/Human toggle in the chat
    # sidebar. Storing the flag on `additional_attributes` means we
    # don't need a schema change — and it survives Captain state
    # being reset on the inbox.
    return false if conversation.additional_attributes&.dig('captain_paused') == true

    # V2 ownership rule (preserved from prior safety pass).
    captain_inbox = inbox.captain_assistant&.captain_inboxes&.first
    return false if captain_inbox.present?

    # Never auto-reply to WhatsApp groups (@g.us) or @broadcast lists.
    # The original code had no group check, which produced a side-effect
    # where Captain replied to messages in production WhatsApp groups
    # belonging to the admin's personal contacts (i.e. random numbers in
    # the device's group chats). Groups are fire-and-forget for Captain.
    return false if whatsapp_group_message?
    return false if broadcast_message?

    # Never auto-reply when the quota has already been burned for the
    # period. captain_active? lives in Enterprise::Inbox and covers this
    # but we double-check as defense in depth.
    return false unless inbox.captain_active?

    true
  end

  def trigger_templates
    super
    return unless captain_safe_to_respond?
    return perform_handoff unless inbox.captain_active?

    schedule_captain_response
  end

  def should_send_greeting?
    return false if captain_handling_conversation?

    super
  end

  def should_send_out_of_office_message?
    return false if captain_handling_conversation?

    super
  end

  def should_send_email_collect?
    return false if captain_handling_conversation?

    super
  end

  private

  # message_type comes from the inbox channel. For WhatsApp, individual
  # chats use '@c.us' or '@lid', groups use '@g.us', broadcast lists use
  # '@broadcast'. Captain should never auto-reply to group / broadcast.
  def whatsapp_group_message?
    inbox.channel_type == 'Channel::Whatsapp' &&
      whatsapp_chat_suffix.in?(%w[@g.us @broadcast])
  end

  def broadcast_message?
    inbox.channel_type == 'Channel::Whatsapp' && whatsapp_chat_suffix == '@broadcast'
  end

  # Best-effort lookup of the chatId suffix from any of the well-known
  # message attributes (sender_id, contact inbox source_id, etc.). If we
  # can't find one we err on the side of NOT auto-replying.
  def whatsapp_chat_suffix
    return nil unless inbox.channel_type == 'Channel::Whatsapp'

    candidates = [
      message.additional_attributes&.dig('chat_id'),
      message.additional_attributes&.dig('openwa_chat_id'),
      contact_inbox_source_id,
      message.sender&.phone_number ? '@c.us' : nil
    ].compact

    candidates.find { |c| c.is_a?(String) }&.then { |c| c.match(/@[a-z.]+\z/)&.[](0) } ||
      '@c.us'
  end

  def contact_inbox_source_id
    contact_inbox = inbox.contact_inboxes.find_by(contact_id: contact.id)
    contact_inbox&.source_id
  end

  def schedule_captain_response
    job_args = [conversation, conversation.inbox.captain_assistant]

    if message.attachments.blank?
      Captain::Conversation::ResponseBuilderJob.perform_later(*job_args)
    else
      wait_time = calculate_attachment_wait_time
      Captain::Conversation::ResponseBuilderJob.set(wait: wait_time).perform_later(*job_args)
    end
  end

  def calculate_attachment_wait_time
    attachment_count = message.attachments.size
    base_wait = 1.second

    additional_wait = [attachment_count * 1, MAX_ATTACHMENT_WAIT_SECONDS].min.seconds
    base_wait + additional_wait
  end

  # Backwards-compatible alias preserved from the prior safety pass.
  def should_process_captain_response?
    captain_safe_to_respond?
  end

  def perform_handoff
    return unless conversation.pending?

    Rails.logger.info("Captain limit exceeded, performing handoff mid-conversation for conversation: #{conversation.id}")
    conversation.messages.create!(
      message_type: :outgoing,
      account_id: conversation.account.id,
      inbox_id: conversation.inbox.id,
      content: 'Transferring to another agent for further assistance.'
    )
    conversation.bot_handoff!
    send_out_of_office_message_after_handoff
  end

  def send_out_of_office_message_after_handoff
    # Campaign conversations should never receive OOO templates — the campaign itself
    # serves as the initial outreach, and OOO would be confusing in that context.
    return if conversation.campaign.present?

    ::MessageTemplates::Template::OutOfOffice.perform_if_applicable(conversation)
  end

  def captain_handling_conversation?
    conversation.pending? && inbox.respond_to?(:captain_assistant) && inbox.captain_assistant.present?
  end
end
