class Webhooks::OpenwaController < ActionController::API
  # Receives events from OpenWA and forwards them to Chatwoot's
  # WhatsApp incoming message pipeline after adapting the payload.
  #
  # OpenWA sends HMAC-signed POSTs. Signature header: X-Openwa-Signature.

  def process_payload
    raw_body = request.raw_post
    session_id = params[:sessionId] || (request.headers['X-Openwa-Session-Id'].presence)

    Rails.logger.info "[OPENWA] Webhook event=#{params[:event]} session=#{session_id}"

    channel = find_channel(session_id)
    return render json: { error: 'Unknown OpenWA session' }, status: :not_found unless channel

    unless valid_signature?(raw_body, channel)
      Rails.logger.warn "[OPENWA] Invalid signature for channel #{channel.id}"
      return render json: { error: 'Invalid signature' }, status: :unauthorized
    end

    adapted = Whatsapp::Openwa::PayloadAdapter.adapt(
      event: params[:event],
      data: parse_data(params[:data] || params['data']),
      session_id: session_id
    )

    if adapted.present?
      Whatsapp::IncomingMessageService.new(
        inbox: channel.inbox,
        params: adapted.deep_symbolize_keys,
        outgoing_echo: params[:event].to_s.start_with?('message.sent')
      ).perform

      # For LID-only chats (private numbers), persist the full chatId on the
      # contact's additional_attributes so the reply path can target it.
      # The standard ContactInbox.source_id strips @lid by Chatwoot's regex
      # validation, so we stash the original on additional_attributes.
      persist_lid_identifier(channel.inbox, adapted)

      # Sync the contact's WhatsApp profile picture into ActiveStorage so it
      # shows in the CRM sidebar. OpenWA doesn't include the pic URL in the
      # webhook payload so we look it up out-of-band via the OpenWA API.
      enqueue_avatar_sync(channel.inbox, adapted)
    end

    head :ok
  rescue StandardError => e
    Rails.logger.error "[OPENWA] Webhook processing error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    head :ok
  end

  private

  # OpenWA delivers the event payload as a URL-encoded JSON string in the
  # `data` form field (per its WebhookApi controller). The payload adapter
  # expects a Hash, so parse it back before handing off. If it's already a
  # Hash (test fixtures) we pass through. If it's a stringified JSON, decode.
  def parse_data(raw)
    return {} if raw.blank?
    return raw if raw.is_a?(Hash)
    return raw if raw.is_a?(ActionController::Parameters)

    JSON.parse(raw)
  rescue JSON::ParserError
    Rails.logger.warn "[OPENWA] Could not parse data field: #{raw.to_s[0..200]}"
    {}
  end

  def find_channel(session_id)
    Channel::Whatsapp.find_by(provider: 'openwa').tap do |ch|
      return ch if ch && ch.provider_config['session_id'] == session_id
    end

    Channel::Whatsapp.where(provider: 'openwa').find do |ch|
      ch.provider_config['session_id'] == session_id
    end
  end

  def valid_signature?(raw_body, channel)
    secret = channel.provider_config['webhook_secret'].presence || ENV['OPENWA_WEBHOOK_SECRET']
    return true if secret.blank? # Allow if no secret configured (dev mode)

    signature = request.headers['X-OpenWA-Signature'].to_s
    # OpenWA sends signature as "sha256=<hex>"
    signature = signature.sub(/\Asha256=/, '')

    expected = OpenSSL::HMAC.hexdigest('SHA256', secret, raw_body)
    ActiveSupport::SecurityUtils.secure_compare(signature, expected)
  end

  # Persist the full @lid / @g.us chatId on the contact so reply messages can
# target it. Chatwoot's standard flow rejects `@lid` source_ids via
# ContactInbox's regex, so we stash the original on additional_attributes.
def persist_lid_identifier(inbox, adapted)
    raw_chat_id = adapted[:raw_chat_id].to_s
    return if raw_chat_id.blank?

    # Skip non-LID / non-group chats — standard phone path is enough.
    return unless raw_chat_id.end_with?('@lid') || raw_chat_id.end_with?('@g.us')

    phone = adapted.dig(:messages, 0, :from).to_s
    return if phone.blank?

    # Defer to a background job so a contact lookup failure here can't take
    # down the webhook delivery (we already returned 200 above).
    Whatsapp::Openwa::LidIdentifierJob.perform_later(
      inbox_id: inbox.id,
      phone: phone,
      raw_chat_id: raw_chat_id
    )
  end

  # Look up the contact's WhatsApp profile picture URL via OpenWA and
  # download it asynchronously into ActiveStorage. Triggered on every
  # incoming message — AvatarFromUrlJob handles dedup + rate-limiting.
  def enqueue_avatar_sync(inbox, adapted)
    phone = adapted.dig(:messages, 0, :from).to_s
    return if phone.blank?

    # Use the LID chatId if present (avatars for LID-only contacts come
    # from the LID profile, not from the +52 fallback).
    raw_chat_id = adapted[:raw_chat_id].to_s
    chat_id =
      if raw_chat_id.end_with?('@lid') || raw_chat_id.end_with?('@g.us')
        raw_chat_id
      else
        "#{phone}@c.us"
      end

    Whatsapp::Openwa::AvatarSyncJob.perform_later(
      inbox_id: inbox.id,
      phone: phone,
      chat_id: chat_id
    )
  end
end