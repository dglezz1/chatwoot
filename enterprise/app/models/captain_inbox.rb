# == Schema Information
#
# Table name: captain_inboxes
#
#  id                   :bigint           not null, primary key
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#  captain_assistant_id :bigint           not null
#  inbox_id             :bigint           not null
#  config               :jsonb            default({}), not null
#
# Indexes
#
#  index_captain_inboxes_on_captain_assistant_id               (captain_assistant_id)
#  index_captain_inboxes_on_captain_assistant_id_and_inbox_id  (captain_assistant_id,inbox_id) UNIQUE
#  index_captain_inboxes_on_inbox_id                           (inbox_id)
#
class CaptainInbox < ApplicationRecord
  belongs_to :captain_assistant, class_name: 'Captain::Assistant'
  belongs_to :inbox

  validates :inbox_id, uniqueness: true

  # Per-inbox config defaults. The auto-reply pipeline reads these on every
  # incoming message. All values are JSON-safe so the jsonb column can store
  # them directly.
  #
  # SAFETY: defaults are conservative. auto_reply_mode is 'off' by default
  # so the bot NEVER auto-replies unless an admin explicitly enables it.
  # require_human_acknowledgment defaults to true so brand-new contacts (no
  # prior conversation) don't get bot replies until a human has approved
  # the contact.
  AUTO_REPLY_MODES = %w[off welcome_only ai].freeze
  DEFAULT_CONFIG = {
    'auto_reply_mode' => 'off',
    'min_response_delay_seconds' => 15,
    'max_response_delay_seconds' => 45,
    'debounce_window_seconds' => 20,
    'welcome_message' => nil,
    'away_message' => nil,
    'business_hours' => nil,
    'handoff_keywords' => [],
    'require_human_acknowledgment' => true,
    'block_list' => [],
    'daily_reply_cap' => 50
  }.freeze

  def effective_config
    merged = DEFAULT_CONFIG.merge(config || {})
    # Validate the mode; fall back to default if invalid
    unless AUTO_REPLY_MODES.include?(merged['auto_reply_mode'])
      merged['auto_reply_mode'] = 'off'
    end
    # Coerce numeric fields
    merged['min_response_delay_seconds'] = merged['min_response_delay_seconds'].to_i
    merged['max_response_delay_seconds'] = merged['max_response_delay_seconds'].to_i
    merged['debounce_window_seconds'] = merged['debounce_window_seconds'].to_i
    merged['daily_reply_cap'] = merged['daily_reply_cap'].to_i
    # Coerce array fields (in case the jsonb had something weird)
    merged['block_list'] = Array(merged['block_list']).map(&:to_s)
    merged['handoff_keywords'] = Array(merged['handoff_keywords']).map(&:to_s)
    merged
  end

  def auto_reply_enabled?
    effective_config['auto_reply_mode'] != 'off'
  end

  # Returns a random delay in seconds within the configured window, used by
  # the AutoReplyJob to look human.
  def response_delay_seconds
    cfg = effective_config
    min = [cfg['min_response_delay_seconds'].to_i, 0].max
    max = [cfg['max_response_delay_seconds'].to_i, min].max
    # Add 1 to max so the range is inclusive on both ends
    min + rand(max - min + 1)
  end

  # Returns the debounce window in seconds — how long the DelayedAutoReplyJob
  # will wait after the last incoming message before firing the LLM call.
  def debounce_window_seconds
    cfg = effective_config
    [cfg['debounce_window_seconds'].to_i, 5].max  # never less than 5s
  end

  # Returns the welcome message to send on first contact, falling back to the
  # assistant's default if the inbox hasn't overridden it.
  def welcome_message
    effective_config['welcome_message'].presence ||
      captain_assistant&.config&.dig('welcome_message')
  end

  # True if the conversation has NOT yet received a bot welcome.
  def welcome_pending?(conversation)
    !conversation.additional_attributes.dig('captain', 'welcome_sent')
  end

  # Records that the welcome was sent (or any other bot reply) so we don't
  # resend the welcome on the next incoming message.
  def mark_welcome_sent!(conversation)
    attrs = conversation.additional_attributes.deep_dup
    attrs['captain'] ||= {}
    attrs['captain']['welcome_sent'] = true
    attrs['captain']['last_bot_reply_at'] = Time.current.iso8601
    conversation.update!(additional_attributes: attrs)
  end

  # Tracks the last time the bot replied in this conversation, used by the
  # DelayedAutoReplyJob to determine which incoming messages to include in
  # the next LLM context.
  def last_bot_reply_at(conversation)
    ts = conversation.additional_attributes.dig('captain', 'last_bot_reply_at')
    ts.present? ? Time.parse(ts) : nil
  end

  # True if the message body matches any handoff keyword (case
  # insensitive). When matched, the bot pauses auto-replies for this
  # conversation and a human agent takes over.
  #
  # Matching strategy: for each keyword, ALL its non-trivial words
  # (length >= 3) must appear in the message. This handles the common
  # case of "hablar con un humano" matching the keyword "hablar con humano"
  # without requiring the user to type the exact phrase.
  def handoff_requested?(message_content)
    keywords = effective_config['handoff_keywords'] || []
    return false if keywords.empty?
    content = message_content.to_s.downcase
    keywords.any? do |kw|
      kw_d = kw.to_s.downcase
      words = kw_d.split(/\s+/).reject { |w| w.length < 3 }
      # If keyword has only short words, require exact substring match
      next content.include?(kw_d) if words.empty?

      words.all? { |w| content.include?(w) }
    end
  end

  # === SAFETY GUARDS ===

  # Returns true if the contact's phone is in this inbox's block list.
  # Bot will never auto-reply to blocked numbers.
  def blocked?(phone)
    return false if phone.blank?
    cleaned = phone.to_s.gsub(/[^\d]/, '')  # strip +, spaces, dashes
    return false if cleaned.empty?
    effective_config['block_list'].any? do |blocked|
      blocked_clean = blocked.to_s.gsub(/[^\d]/, '')
      next false if blocked_clean.empty?
      # Match by exact digits OR by suffix (so "+5215556667777" matches
      # the block entry "5556667777" if the admin only blocked the local part)
      cleaned == blocked_clean ||
        cleaned.end_with?(blocked_clean) ||
        blocked_clean.end_with?(cleaned)
    end
  end

  # True if a human agent has acknowledged this contact at least once.
  # When false AND require_human_acknowledgment is true, the bot will NOT
  # auto-reply to this contact.
  def human_acknowledged?(contact)
    return false if contact.nil?
    # Contact is acknowledged if they have any prior CONVERSATION in this inbox
    # that the bot didn't initiate. We check via a prior message from a User
    # (not a Contact or Captain::Assistant).
    prior_user_messages = Message
                                .joins(:conversation)
                                .where(conversations: { contact_id: contact.id, inbox_id: inbox_id })
                                .where(sender_type: 'User')
                                .limit(1)
    prior_user_messages.exists?
  end

  # True if the bot should skip this contact because the daily cap was
  # reached. We count bot-sent outgoing messages (sender_type = User,
  # created today) against the cap.
  def daily_cap_reached?
    cap = effective_config['daily_reply_cap'].to_i
    return false if cap <= 0  # 0 = unlimited

    today_count = Message
                           .joins(:conversation)
                           .where(conversations: { inbox_id: inbox_id })
                           .where(message_type: :outgoing)
                           .where(sender_type: 'User')
                           .where('messages.created_at > ?', 24.hours.ago)
                           .count
    today_count >= cap
  end

  # Master guard: returns true if the bot is allowed to reply to this
  # contact's message. Reasons it would return false (in priority order):
  #   1. auto_reply_mode is 'off' (or unknown)
  #   2. Contact is on the block list
  #   3. Daily cap reached
  #   4. require_human_acknowledgment is true AND no human has ever
  #      replied to this contact
  def safe_to_auto_reply?(contact, phone:)
    return false unless auto_reply_enabled?
    return false if blocked?(phone)
    return false if daily_cap_reached?
    if effective_config['require_human_acknowledgment']
      return false unless human_acknowledged?(contact)
    end
    true
  end

  # The reason a contact was skipped (for logging/debugging).
  def skip_reason(contact, phone:)
    return 'mode_off' unless auto_reply_enabled?
    return 'blocked' if blocked?(phone)
    return 'daily_cap' if daily_cap_reached?
    if effective_config['require_human_acknowledgment'] && !human_acknowledged?(contact)
      return 'needs_human_acknowledgment'
    end
    nil
  end
end
