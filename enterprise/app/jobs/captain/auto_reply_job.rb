# frozen_string_literal: true

# Auto-reply debouncer.
#
# This is the FIRST stage of the Captain auto-reply pipeline. It fires from
# CaptainListener#message_created for every incoming message in a
# Captain-enabled inbox. Its only job is to decide whether to schedule a
# Captain::DelayedAutoReplyJob or to skip because one is already scheduled.
#
# Why this two-stage design:
#   - Multiple messages from the same contact (within the debounce window)
#     collapse into ONE bot reply instead of N.
#   - The reply is delayed by a random 15-45s (configurable per inbox) so
#     WhatsApp doesn't pattern-detect the bot.
#   - Per-inbox config (mode, delays, welcome message, handoff keywords)
#     is read at schedule time, so changes apply to the next reply.
#
# The actual LLM call + sending happens in Captain::DelayedAutoReplyJob.
class Captain::AutoReplyJob < ApplicationJob
  queue_as :default

  # Redis key for the "reply scheduled" debounce lock. Set when we enqueue
  # a DelayedAutoReplyJob, cleared at the end of that job's perform.
  SCHEDULED_KEY_PREFIX = 'captain:reply_scheduled:conv:%<id>s'.freeze
  SCHEDULED_TTL = 5.minutes.to_i

  def perform(message_id)
    message = Message.find_by(id: message_id)
    return unless message
    return unless message.incoming?
    return if message.private
    return if message.content.blank?

    inbox = message.inbox
    return unless inbox&.captain_active?

    captain_inbox = inbox.captain_assistant&.captain_inboxes&.first
    return unless captain_inbox
    return unless captain_inbox.auto_reply_enabled?

    conversation = message.conversation
    return if conversation.assignee_id.present? && !conversation.assignee.is_a?(Captain::Assistant)

    # NEVER auto-reply to WhatsApp groups (@g.us) or broadcast lists
    # (@broadcast). Captain is for 1:1 conversations only. Without this
    # guard the bot can land replies in admin personal WhatsApp groups,
    # which is what caused the 2026-07-03 spam incident.
    return if whatsapp_group_or_broadcast?(message)

    # SAFETY GUARD: skip if blocked / capped / needs human acknowledgment
    phone = message.sender.is_a?(Contact) ? message.sender.phone_number : nil
    unless captain_inbox.safe_to_auto_reply?(conversation.contact, phone: phone)
      reason = captain_inbox.skip_reason(conversation.contact, phone: phone)
      Rails.logger.info "[Captain::AutoReplyJob] skip conv=#{conversation.id} phone=#{phone} reason=#{reason}"
      return
    end

    schedule_delayed_reply(conversation, captain_inbox)
  rescue StandardError => e
    Rails.logger.error "[Captain::AutoReplyJob] error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
  end

  private

  def whatsapp_group_or_broadcast?(message)
    return false unless message.inbox.channel_type == 'Channel::Whatsapp'

    suffix = chat_suffix(message)
    suffix.in?(%w[@g.us @broadcast])
  end

  def chat_suffix(message)
    candidates = [
      message.additional_attributes&.dig('chat_id'),
      message.additional_attributes&.dig('openwa_chat_id'),
      message.conversation&.contact_inbox&.source_id,
      message.sender.is_a?(Contact) ? '@c.us' : nil
    ].compact
    candidates.find { |c| c.is_a?(String) }&.then { |c| c.match(/@[a-z.]+\z/)&.[](0) } ||
      '@c.us'
  end

  def schedule_delayed_reply(conversation, captain_inbox)
    # Debounce: if a delayed job is already scheduled for this conversation,
    # do nothing. The already-scheduled DelayedAutoReplyJob will pick up the
    # new pending messages when it fires.
    scheduled_key = format(SCHEDULED_KEY_PREFIX, id: conversation.id)
    return unless ::Redis::Alfred.set(scheduled_key, true, nx: true, ex: SCHEDULED_TTL)

    # Enqueue the delayed reply with a random human-like delay.
    delay = captain_inbox.response_delay_seconds
    Rails.logger.info "[Captain::AutoReplyJob] scheduling reply for conv=#{conversation.id} in #{delay}s (debounce=#{captain_inbox.debounce_window_seconds}s)"

    # We need to clear the scheduled key once the delayed job has run, but
    # we can't chain a callback from perform_in. Instead, the DelayedAutoReplyJob
    # uses a separate "running" lock so a duplicate run is a no-op. After the
    # job finishes, we just let the scheduled key expire naturally.
    Captain::DelayedAutoReplyJob.set(wait: delay.seconds).perform_later(conversation.id)
  end
end
