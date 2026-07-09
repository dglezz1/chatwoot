# frozen_string_literal: true

# Delayed auto-reply job — fires after a random human-like delay.
#
# Triggered by Captain::AutoReplyJob when an incoming message arrives in a
# Captain-enabled inbox. The AutoReplyJob acts as a debouncer: if a delayed
# reply is already scheduled for the same conversation, it does nothing,
# so multiple rapid messages collapse into a single response.
#
# When this job actually runs, it waits an additional `debounce_window_seconds`
# to let stragglers settle, then:
#   1. Re-checks there are still pending unanswered incoming messages.
#   2. Picks the response strategy: welcome vs AI vs nothing.
#   3. Calls AgentRunnerService with the combined message history.
#   4. Sends the reply through Messages::MessageBuilder + SendReplyJob.
#
# All delay/window settings are read from CaptainInbox#effective_config.
class Captain::DelayedAutoReplyJob < ApplicationJob
  queue_as :default

  # Redis key for the "reply scheduled" debounce lock.
  # Set by AutoReplyJob#schedule_delayed_reply, cleared at the end of
  # this job's perform. TTL is generous (5 min) so a crashed worker
  # doesn't block the next round of messages forever.
  DEBOUNCE_KEY_PREFIX = 'captain:reply_scheduled:conv:%<id>s'.freeze
  DEBOUNCE_TTL = 5.minutes.to_i

  # Lock key used to ensure only one delayed job per conversation runs at
  # a time, even if multiple get scheduled before the first one fires.
  RUNNING_KEY_PREFIX = 'captain:reply_running:conv:%<id>s'.freeze
  RUNNING_TTL = 5.minutes.to_i

  def perform(conversation_id)
    conversation = Conversation.find_by(id: conversation_id)
    return unless conversation
    return unless conversation.inbox&.captain_active?

    captain_inbox = conversation.inbox&.captain_assistant&.captain_inboxes&.first
    return unless captain_inbox
    return unless captain_inbox.auto_reply_enabled?

    # Bounce if the conversation has been taken over by a human agent
    # (assignee set) since the message was enqueued.
    return if conversation.assignee_id.present? && !conversation.assignee.is_a?(Captain::Assistant)

    # Use a "running" lock to prevent two DelayedAutoReplyJobs from
    # concurrently processing the same conversation (e.g. if a worker
    # restart caused a duplicate enqueue).
    running_key = format(RUNNING_KEY_PREFIX, id: conversation.id)
    return unless ::Redis::Alfred.set(running_key, true, nx: true, ex: RUNNING_TTL)
    begin
      # Clear the AutoReplyJob's "reply scheduled" lock so the NEXT incoming
      # message after this reply can schedule a fresh delayed job.
      scheduled_key = format(Captain::AutoReplyJob::SCHEDULED_KEY_PREFIX, id: conversation.id)
      ::Redis::Alfred.delete(scheduled_key)
      process_conversation(conversation, captain_inbox)
    ensure
      ::Redis::Alfred.delete(running_key)
    end
  rescue StandardError => e
    Rails.logger.error "[Captain::DelayedAutoReplyJob] error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
  end

  private

  def process_conversation(conversation, captain_inbox)
    # Wait an extra debounce window to collect stragglers. If more messages
    # arrive during this sleep, the next message's AutoReplyJob will see
    # the running lock and skip — but the debounce key in AutoReplyJob
    # was already cleared, so subsequent messages will schedule another
    # delayed job (which will skip due to the running lock). This is fine:
    # the running lock ensures only one reply per cycle.
    sleep(captain_inbox.debounce_window_seconds)

    # Refresh the conversation in case the user replied again.
    conversation.reload

    # Pick the messages that still need a response: incoming messages after
    # the last bot reply. If we already replied to everything, abort.
    pending = pending_incoming_messages(conversation, captain_inbox)
    if pending.empty?
      Rails.logger.info "[Captain::DelayedAutoReplyJob] no pending messages for conv=#{conversation.id}, aborting"
      return
    end

    # Handoff check: if the latest message asks for a human, escalate
    # instead of auto-replying. Marks the conversation so subsequent
    # messages from this contact don't get auto-handled.
    if captain_inbox.handoff_requested?(pending.last.content)
      send_handoff_message(conversation, captain_inbox, pending)
      return
    end

    # Pick response strategy
    response_text =
      if captain_inbox.welcome_pending?(conversation)
        welcome_message_for(conversation, captain_inbox)
      elsif captain_inbox.effective_config['auto_reply_mode'] == 'welcome_only'
        # welcome_only mode: only reply with the welcome on first contact,
        # and a confirmation on subsequent. Skip LLM entirely.
        away_or_fallback(captain_inbox, conversation)
      else
        ai_response_for(conversation, captain_inbox, pending)
      end

    return if response_text.blank?

    deliver_reply(conversation, captain_inbox, response_text)
    captain_inbox.mark_welcome_sent!(conversation)
  end

  def pending_incoming_messages(conversation, captain_inbox)
    last_reply = captain_inbox.last_bot_reply_at(conversation)
    scope = conversation.messages.where(message_type: :incoming, private: false)
    scope = scope.where('created_at > ?', last_reply) if last_reply
    scope.where.not(content: [nil, '']).order(:created_at)
  end

  def welcome_message_for(conversation, captain_inbox)
    captain_inbox.welcome_message
  end

  def away_or_fallback(captain_inbox, conversation)
    # In welcome_only mode after the first contact, use the handoff message
    # as a "we'll be right back" placeholder.
    captain_inbox.captain_assistant.config&.dig('handoff_message') ||
      I18n.t('captain.auto_reply.welcome_only', default: 'Gracias por tu mensaje. Un agente te responderá en breve.')
  end

  def ai_response_for(conversation, captain_inbox, pending_messages)
    history = build_message_history(conversation, captain_inbox, pending_messages)
    result = Captain::Assistant::AgentRunnerService.new(
      assistant: captain_inbox.captain_assistant,
      conversation: conversation,
      source: 'auto_reply'
    ).generate_response(message_history: history)

    result['response'].to_s.strip
  end

  def send_handoff_message(conversation, captain_inbox, _pending)
    msg = captain_inbox.captain_assistant.config&.dig('handoff_message') ||
      I18n.t('captain.auto_reply.handoff', default: 'Te conecto con un humano del equipo 👤. En un momento alguien te contacta por aquí.')

    # Mark conversation as assigned to a human (bot handoff) so future
    # messages don't get auto-replied. We assign to the inbox's first agent
    # (same lookup as the regular send path).
    deliver_reply(conversation, captain_inbox, msg, mark_human: true)
    captain_inbox.mark_welcome_sent!(conversation)
  end

  def deliver_reply(conversation, captain_inbox, response_text, mark_human: false)
    sender = find_or_create_bot_user(account: conversation.account)
    builder = Messages::MessageBuilder.new(sender, conversation, {
      message_type: 'outgoing',  # String, not Symbol — MessageBuilder compares with ==
      content_type: 'text',
      content: response_text,
      private: false
    })
    builder.perform

    # If handoff, attempt to claim the conversation for a human agent.
    if mark_human
      agent = conversation.inbox.account.account_users.joins(:user).first&.user
      conversation.update(assignee: agent) if agent
    end
  end

  def build_message_history(conversation, _captain_inbox, pending_messages)
    # Build a history including the pending messages. We use the same
    # agent_role=assistant, user_role=user mapping as before.
    history_from = conversation.messages
                                .where(message_type: [:incoming, :outgoing], private: false)
                                .order(:created_at)
    msgs = history_from.to_a
    # Append any pending that haven't been persisted yet (shouldn't happen
    # in practice since we read from DB, but safe).
    pending_messages.each do |pm|
      msgs << pm unless msgs.find { |m| m.id == pm.id }
    end

    msgs.last(20).map do |m|
      {
        role: m.outgoing? ? 'assistant' : 'user',
        content: m.content.to_s
      }
    end
  end

  def find_or_create_bot_user(account:)
    account.account_users.joins(:user).order(:id).first&.user ||
      User.joins(:account_users).where(account_users: { account_id: account.id }).first
  end
end
