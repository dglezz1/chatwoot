class Whatsapp::Openwa::PayloadAdapter
  # Maps OpenWA webhook event payloads into the canonical params shape that
  # Whatsapp::IncomingMessageService (modeled after 360dialog) understands.
  #
  # OpenWA sends events like:
  #   { event: "message.received", sessionId: "...", data: { id, from, body, type, ... } }
  #   { event: "message.ack",      sessionId: "...", data: { id, ack: 2 } }
  #   { event: "message.revoked",  sessionId: "...", data: { id } }
  #   { event: "session.status",   sessionId: "...", data: { status: "connected" } }
  #
  # Chatwoot's Whatsapp::IncomingMessageService expects:
  #   { messages: [{ id, from, type, text: {body}, ... }], contacts: [...], statuses: [...] }

  def self.adapt(event:, data:, session_id:)
    new(event: event, data: data || {}, session_id: session_id).adapt
  end

  def initialize(event:, data:, session_id:)
    @event = event.to_s
    @data = data || {}
    @session_id = session_id
  end

  def adapt
    case @event
    when 'message.received' then adapt_received_message
    when 'message.sent'     then adapt_sent_message
    when 'message.ack', 'message.revoked' then adapt_status_update
    else {}
    end
  end

  private

  # Receive a normal incoming message.
  def adapt_received_message
    return {} if outgoing?

    # Prefer `chatId` (canonical conversation id) over `from` (which may be a sender lid).
    chat_id = (@data['chatId'] || @data[:chatId]) || (@data['from'] || @data[:from])
    return {} if chat_id.blank?

    # Skip broadcast lists (@broadcast) — not supported yet.
    return {} if chat_id.to_s.end_with?('@broadcast')

    is_group = chat_id.to_s.end_with?('@g.us')

    # For groups, the `from` field is the *author* of the message (individual sender),
    # not the group. For individual chats, `from` == chat_id and both can be used.
    author_chat_id = is_group ? (@data['from'] || @data[:from] || @data['author'] || @data[:author]).to_s : chat_id
    author_chat_id = author_chat_id.to_s
    return {} if author_chat_id.blank?

    phone = resolve_phone(author_chat_id, @data)
    return {} if phone.blank?

    is_lid = author_chat_id.end_with?('@lid') || chat_id.end_with?('@lid')
    type   = map_message_type(@data['type'] || @data[:type])

    msg = {
      id: @data['id'] || @data[:id],
      from: phone,
      type: type,
      timestamp: @data['timestamp'] || @data[:timestamp]
    }

    case type
    when 'text'
      msg[:text] = { body: (@data['body'] || @data[:body]).to_s }
    when 'image', 'video', 'audio', 'document', 'sticker'
      media = @data['media'] || @data[:media] || {}
      msg[type] = {
        id: media['id'] || media[:id],
        mime_type: media['mimetype'] || media[:mimetype],
        sha256: media['sha256'] || media[:sha256],
        caption: (@data['body'] || @data[:body]).to_s.presence
      }
      msg[type][:url]      = media['url']      || media[:url]      if media['url']      || media[:url]
      msg[type][:filename] = media['filename'] || media[:filename] if media['filename'] || media[:filename]
    when 'location'
      loc = @data['location'] || @data[:location] || {}
      msg[:location] = {
        latitude:  loc['latitude']  || loc[:latitude],
        longitude: loc['longitude'] || loc[:longitude],
        name:      loc['name']      || loc[:name],
        address:   loc['address']   || loc[:address]
      }
    when 'contacts'
      msg[:contacts] = Array(@data['contacts'] || @data[:contacts])
    when 'reaction'
      reaction = @data['reaction'] || @data[:reaction] || {}
      msg[:reaction] = { text: reaction['text'] || reaction[:text], emoji: reaction['emoji'] || reaction[:emoji] }
    else
      msg[:text] = { body: (@data['body'] || @data[:body]).to_s }
      msg[:type] = 'text'
    end

    contact_attrs = {
      profile: { name: (@data['pushName'] || @data[:pushName] || @data.dig('_data', 'notifyName')).to_s },
      wa_id: phone
    }
    # Note: we deliberately do NOT pass `user_id: chat_id` here even for LID
    # senders — Chatwoot's ContactInbox validates `source_id` against a strict
    # regex (`\A\d{1,15}\z` or `[A-Z]{2}\..*`) that rejects `@lid` IDs.
    # The full @lid chatId is persisted by the webhook controller on
    # contact.additional_attributes['openwa_chat_id'] instead.

    result = {
      messages: [msg.compact],
      contacts: [contact_attrs]
    }
    result[:source_id] = msg[:id] if msg[:id].present?
    result[:chat_id]   = chat_id if is_group
    # Expose the raw chatId (with @lid / @g.us suffix) so the webhook
    # controller can persist it on contact.additional_attributes for the
    # reply path. Chatwoot strips @lid from ContactInbox.source_id because
    # of its strict regex validation, so the original is otherwise lost.
    result[:raw_chat_id] = chat_id if chat_id.to_s.include?('@')
    result.compact
  end

  # Echo of a message we just sent from another device (multi-device mode).
  def adapt_sent_message
    return {} unless outgoing?

    chat_id = @data['chatId'] || @data[:chatId] || @data['to'] || @data[:to]
    phone   = chat_id.present? ? phone_from_chat_id(chat_id) : ''
    body    = (@data['body'] || @data[:body]).to_s

    msg = {
      id: @data['id'] || @data[:id],
      from: phone,
      type: 'text',
      text: { body: body }
    }
    { messages: [msg], message_echoes: [msg] }
  end

  # Read receipts / message revocation.
  def adapt_status_update
    msg_id = @data['id'] || @data[:id] || @data['messageId'] || @data[:messageId]
    return {} if msg_id.blank?

    statuses =
      case @event
      when 'message.ack'
        [{
          id: msg_id,
          status: map_ack_status(@data['ack'] || @data[:ack]),
          recipient_id: phone_from_chat_id(@data['to'] || @data[:to]),
          timestamp: @data['timestamp'] || @data[:timestamp]
        }]
      when 'message.revoked'
        [{ id: msg_id, status: 'deleted', timestamp: Time.now.to_i }]
      else
        []
      end

    return {} if statuses.empty?

    { statuses: statuses }
  end

  def incoming?
    v = @data['fromMe'] || @data[:fromMe]
    v == false || v.nil?
  end

  def outgoing?
    v = @data['fromMe'] || @data[:fromMe]
    v == true
  end

  def map_message_type(type)
    case type.to_s
    when 'chat', 'text', 'extendedText' then 'text'
    when 'image', 'video', 'audio', 'document', 'sticker' then type.to_s
    when 'ptt' then 'audio'
    when 'location' then 'location'
    when 'vcard', 'contact', 'contacts' then 'contacts'
    when 'reaction' then 'reaction'
    when 'revoked' then 'unsupported'
    else 'text'
    end
  end

  def map_ack_status(ack)
    case ack.to_i
    when 1 then 'sent'
    when 2 then 'delivered'
    when 3, 4 then 'read'
    when -1, 0 then 'failed'
    else 'sent'
    end
  end

  # OpenWA chat_id format: "<digits>@c.us" or "<digits>@g.us"
  def phone_from_chat_id(chat_id)
    chat_id.to_s.split('@').first
  end

  # Try to resolve a real phone number from the chat_id. Handles three cases:
  #
  #   1. chat_id ends in @c.us        → use it directly (e.g. "5215512345678@c.us")
  #   2. chat_id ends in @lid         → multi-device mode ("número privado");
  #                                     fall back to sibling fields that may
  #                                     carry the real phone number, OR use
  #                                     the LID's own digit payload as a
  #                                     last-resort identifier (WhatsApp
  #                                     sometimes only sends the LID, no
  #                                     underlying phone, in which case we
  #                                     use the LID as the contact's
  #                                     identifier and persist the full
  #                                     chatId on additional_attributes
  #                                     for the reply path).
  #   3. anything else                → try as bare identifier; return if ≥ 8 digits.
  def resolve_phone(chat_id, data)
    suffix = chat_id.to_s.split('@').last
    return nil if suffix.nil? || suffix == 'g.us' || suffix == 'broadcast'

    return phone_from_chat_id(chat_id) if suffix == 'c.us'

    if suffix == 'lid'
      candidates = [
        data['from'].to_s.end_with?('@c.us') ? data['from'] : nil,
        data['_serialized'],
        data['author'],
        data['sender'],
        data.dig('quotedMessage', 'from'),
        data.dig('quotedMessage', 'author'),
        data.dig('quotedMessage', 'participant'),
        extract_compound_phone(data['id'])
      ].compact

      candidates.each do |c|
        next if c.blank?
        return phone_from_chat_id(c) if c.to_s.end_with?('@c.us')

        digits = c.to_s.gsub(/\D/, '')
        return digits if digits.length >= 8
      end

      # Fallback: no sibling field had a real phone, but the chat_id itself
      # contains a long numeric payload (the LID). Use those digits as the
      # contact's identifier so the message isn't silently dropped. The
      # webhook controller persists the full @lid chatId on
      # contact.additional_attributes['openwa_chat_id'] for the reply path.
      digits = chat_id.to_s.gsub(/\D/, '')
      return digits if digits.length >= 8
      nil
    end

    digits = chat_id.to_s.gsub(/\D/, '')
    return digits if digits.length >= 8
    nil
  end

  # Compound IDs from whatsapp-web.js sometimes look like
  #   "false_120363306418924780@g.us_ACE8A8AF..._55538708680855@lid"
  # Extract the embedded @c.us or @s.whatsapp.net piece.
  def extract_compound_phone(id)
    return nil if id.blank?

    match = id.to_s.match(/(\d+@(?:c\.us|s\.whatsapp\.net))/)
    match && match[1]
  end
end