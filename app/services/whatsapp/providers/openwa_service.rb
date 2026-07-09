#######################################
# OpenWA WhatsApp Provider
# https://github.com/rmyndharis/OpenWA
#
# Implements the Whatsapp::Providers::BaseService interface for OpenWA,
# a WhatsApp Web API Gateway (uses whatsapp-web.js under the hood).
#
# Required provider_config keys:
#   - session_id: OpenWA session UUID (from POST /api/sessions)
#
# Optional provider_config keys:
#   - api_base_url: defaults to ENV['OPENWA_API_BASE_URL'] or 'http://openwa:2785'
#   - api_key: defaults to ENV['OPENWA_API_KEY']
#
# OpenWA API contract (from /api/docs-json):
#   - Auth: header X-Api-Key (NOT Authorization: Bearer)
#   - All send-* media endpoints use a FLAT SendMediaMessageDto:
#       { chatId, url | base64+mimetype, filename, caption }
#     NOT the nested { type: { url, ... } } shape used by Meta Cloud API.
#   - send-text: SendTextMessageDto { chatId, text, quotedMessageId? }
#   - send-sticker: SendMediaMessageDto (use with image/webp)
#   - send-reply / send-react: dedicated endpoints with their own DTOs
#   - send-location: BROKEN in current OpenWA build (Location is not a constructor)
#   - Templates: NOT supported (raise NotImplementedError)
#
# Public URL requirement:
#   - download_url returns a signed blob URL on localhost:3000. OpenWA's
#     whatsapp-web.js fetches from the OPENWA container's perspective —
#     `localhost` won't resolve to the rails container. Set
#     OPENWA_PUBLIC_BASE_URL in OpenWA env so blob URLs are rewritten to
#     a host the OpenWA container can reach (e.g. http://chatwoot.local:3000).
#######################################
class Whatsapp::Providers::OpenwaService < Whatsapp::Providers::BaseService
  # Routes a message to the correct OpenWA endpoint based on content/attachments.
  def send_message(phone_number, message)
    @message = message

    if message.attachments.present?
      send_attachment_message(phone_number, message)
    elsif message.content_type == 'input_select'
      # OpenWA has no native interactive buttons/lists; render as plain text.
      send_input_select_message(phone_number, message)
    else
      send_text_message(phone_number, message)
    end
  end

  def send_template(_phone_number, _template_info, _message)
    raise NotImplementedError, 'OpenWA does not support Meta-style templates. Use session messages directly.'
  end

  def sync_templates
    whatsapp_channel.mark_message_templates_updated
  end

  def validate_provider_config?
    response = api_get("/api/sessions/#{session_id}")
    return false unless response.success?

    parsed = response.parsed_response
    parsed.is_a?(Hash) && parsed['id'] == session_id
  rescue StandardError => e
    Rails.logger.error "[OPENWA] validate_provider_config failed: #{e.message}"
    false
  end

  def media_url(media_id)
    "#{api_base_url}/api/sessions/#{session_id}/messages/#{media_id}/media"
  end

  # Send a reaction emoji to a message. Chatwoot's frontend lets agents pick from
  # a small list; the source_id is the OpenWA messageId of the message being reacted to.
  def send_reaction(phone_number, message_id, emoji)
    body = {
      chatId: phone_number,
      messageId: message_id,
      reaction: emoji.to_s
    }
    response = api_post('/api/sessions/{session}/messages/react', body)
    process_response(response, @message)
  end

  # ---- public config helpers (used by webhook + admin UI) ----

  def api_headers
    { 'X-API-Key' => api_key, 'Content-Type' => 'application/json' }
  end

  def api_base_url
    whatsapp_channel.provider_config['api_base_url'].presence ||
      ENV['OPENWA_API_BASE_URL'].presence ||
      'http://openwa:2785'
  end

  def api_key
    whatsapp_channel.provider_config['api_key'].presence || ENV['OPENWA_API_KEY'].to_s
  end

  def session_id
    whatsapp_channel.provider_config['session_id'].to_s
  end

  # Build OpenWA chat_id from an E.164 phone number.
  # OpenWA / whatsapp-web.js uses chat IDs like "5215512345678@c.us"
  def chat_id_for(phone_number)
    digits = phone_number.to_s.gsub(/\D/, '')
    "#{digits}@c.us"
  end

  private

  def send_text_message(phone_number, message)
    body = {
      chatId: destination_chat_id(phone_number, message),
      text: message.outgoing_content.to_s
    }

    if (reply_to = message.content_attributes[:in_reply_to_external_id]).present?
      body[:quotedMessageId] = reply_to
    end

    response = api_post('/api/sessions/{session}/messages/send-text', body)
    process_response(response, message)
  end

  # Render an input_select as a numbered list — preserves the information
  # without requiring interactive buttons (which OpenWA/whatsapp-web.js
  # doesn't expose programmatically).
  def send_input_select_message(phone_number, message)
    items = message.content_attributes['items'] || []
    lines = [message.outgoing_content.to_s]
    items.each_with_index do |item, i|
      title = item['title'] || item['value']
      lines << "#{i + 1}. #{title}"
    end
    lines << I18n.t('conversations.messages.whatsapp.input_select.reply_hint', default: 'Reply with the number of your choice.')

    message.content_attributes = (message.content_attributes || {}).merge('outgoing_rendered_text' => lines.join("\n"))

    response = api_post('/api/sessions/{session}/messages/send-text', {
      chatId: destination_chat_id(phone_number, message),
      text: lines.join("\n")
    })
    process_response(response, message)
  end

  # Pick the right chatId for the destination:
  #   1. If the contact has an openwa_chat_id (private-number LID or group LID
  #      saved by the webhook controller), use it — that's the only address
  #      OpenWA accepts.
  #   2. If the contact_inbox has a fully-qualified WhatsApp source_id
  #      (e.g. "<lid>@lid", "<digits>@c.us" or "<id>@g.us"), use it as-is.
  #   3. Otherwise build "<phone>@c.us" from the phone number.
  def destination_chat_id(phone_number, message)
    contact = message&.conversation&.contact
    stored = contact&.additional_attributes&.dig('openwa_chat_id').to_s
    return stored if stored.include?('@')

    contact_inbox = message&.conversation&.contact_inbox
    source_id = contact_inbox&.source_id.to_s
    return source_id if source_id.include?('@')

    chat_id_for(phone_number)
  end

  # Map Chatwoot attachment file_type → OpenWA send-* endpoint.
  #
  # OpenWA's media endpoints all accept SendMediaMessageDto (FLAT shape):
  #   { chatId, url, filename, caption }
  # Meta's nested { type: { url, ... } } shape returns HTTP 400.
  #
  # We use `attachment.file.url` (direct disk URL, serves Content-Type correctly)
  # instead of `attachment.download_url` (which returns the /redirect/ URL that
  # lacks Content-Type and breaks whatsapp-web.js's MIME detection).
  #
  # For voice messages (Chatwoot marks `meta.is_voice_message = true`), we route
  # to send-audio; whatsapp-web.js plays audio/ogg as voice notes when mimetype
  # is audio/ogg; codecs may vary.
  def send_attachment_message(phone_number, message)
    attachment = message.attachments.first
    # Sidekiq runs without a request, so ActiveStorage::Current.url_options is
    # blank. Set it from Rails defaults before generating the URL — same trick
    # `Attachment#download_url` uses.
    ActiveStorage::Current.url_options = Rails.application.routes.default_url_options if ActiveStorage::Current.url_options.blank?
    url = rewrite_url_for_openwa(attachment.file.url)
    chat_id = destination_chat_id(phone_number, message)

    # Route by attachment type
    endpoint, payload = case attachment.file_type
                        when 'image'  then build_media_payload('/api/sessions/{session}/messages/send-image',    chat_id, url, attachment, message, include_caption: true)
                        when 'video'  then build_media_payload('/api/sessions/{session}/messages/send-video',    chat_id, url, attachment, message, include_caption: true)
                        when 'audio'  then build_media_payload('/api/sessions/{session}/messages/send-audio',    chat_id, url, attachment, message, include_caption: false)
                        when 'sticker'then build_media_payload('/api/sessions/{session}/messages/send-sticker',  chat_id, url, attachment, message, include_caption: false)
                        else                build_media_payload('/api/sessions/{session}/messages/send-document', chat_id, url, attachment, message, include_caption: true)
                        end

    response = api_post(endpoint, payload)
    process_response(response, message)
  end

  def build_media_payload(endpoint, chat_id, url, attachment, message, include_caption:)
    mime = attachment.file.blob&.content_type
    payload = {
      chatId: chat_id,
      url: url,
      mimetype: mime,
      filename: attachment.file.filename.to_s
    }
    if include_caption && message.outgoing_content.present?
      payload[:caption] = message.outgoing_content.to_s
    end
    [endpoint, payload.compact]
  end

  # Rewrite localhost:3000 URLs to a host that the OpenWA container can reach.
  # Without this, OpenWA's fetch fails to resolve `localhost`.
  def rewrite_url_for_openwa(url)
    return url if url.blank?

    public_base = ENV['OPENWA_PUBLIC_BASE_URL'].presence
    return url if public_base.blank?

    URI.parse(url).then do |u|
      u.scheme = URI.parse(public_base).scheme
      u.host   = URI.parse(public_base).host
      u.port   = URI.parse(public_base).port if URI.parse(public_base).port
      u.to_s
    end
  rescue URI::InvalidURIError
    url
  end

  def api_get(path)
    HTTParty.get("#{api_base_url}#{path}", headers: api_headers, timeout: 30)
  end

  def api_post(path_template, body)
    url = "#{api_base_url}#{path_template.gsub('{session}', session_id)}"
    Rails.logger.info "[OPENWA] POST #{url} body=#{body.to_json[0..200]}"
    response = HTTParty.post(
      url,
      headers: api_headers,
      body: body.to_json,
      timeout: 60
    )
    Rails.logger.info "[OPENWA] Response: HTTP #{response.code} #{response.body.to_s[0..200]}"
    response
  end

  # Override base process_response to handle OpenWA's response shape.
  # OpenWA returns { messageId, status, ... } on success, { statusCode, message, error? } on failure.
  def process_response(response, message)
    parsed = response.parsed_response
    Rails.logger.warn "[OPENWA] process_response: success=#{response.success?} code=#{response.code} parsed=#{parsed.inspect[0..200]}"
    if response.success? && (parsed.blank? || (parsed.is_a?(Hash) && parsed['error'].blank? && parsed['statusCode'].blank?))
      parsed.is_a?(Hash) ? parsed['messageId'] || parsed['id'] : nil
    else
      handle_error(response, message)
      nil
    end
  end

  def error_message(response)
    parsed = response.parsed_response
    return nil if parsed.blank?
    return parsed if parsed.is_a?(String)

    Rails.logger.warn "[OPENWA] error_message parsed=#{parsed.inspect[0..300]}"
    parsed['message'] ||
      parsed.dig('error', 'message') ||
      (parsed['message'].is_a?(Array) ? parsed['message'].first : nil) ||
      parsed['error']
  end
end