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
      # Chambeabot: WhatsApp's multi-device protocol marks every message
      # leaving any device on the authenticated account as `fromMe: true`,
      # which OpenWA surfaces as the `message.sent` event. That event fires
      # for BOTH (a) messages the operator sent from this very web session
      # and (b) messages the account owner sent from another phone on the
      # same WhatsApp account. We cannot tell them apart from the event
      # alone, but we don't have to: the IncomingMessageService's
      # `find_message_by_source_id` short-circuits any source_id that was
      # already persisted by `SendOnWhatsappService` (case a), so the
      # remaining `message.sent` payloads that survive the lookup are
      # guaranteed to be multidevice messages that need to be created as
      # `incoming` for the contact. Marking them `outgoing_echo: true`
      # would store them as `outgoing` from the agent and hide them from
      # the operator's inbox — exactly what was happening with the
      # customer's real "hey" messages.
      Whatsapp::IncomingMessageService.new(
        inbox: channel.inbox,
        params: adapted.deep_symbolize_keys,
        outgoing_echo: false
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
    # Look up the channel whose provider_config carries the incoming
    # session_id. Use the simple `where(...).find_by(...)` form so the
    # query is a single SQL hit instead of a tap+where iteration.
    # The old `tap` + `where.find` shape was correct but opaque; this
    # is the same logic in one expression.
    Channel::Whatsapp.find_by(
      provider: 'openwa',
      provider_config: { session_id: session_id }
    )
  rescue StandardError
    # Chambeabot: the JSONB containment match (`provider_config @> '{"session_id":"..."}'`)
    # silently returns nil when the JSONB column got re-serialized in a way that breaks
    # the @> operator (we saw this happen after PATCH /inboxes/11 to swap session_id — the
    # query would return 404 even though the row clearly has the matching session_id in its
    # JSON. The Rails adapter doesn't raise, it just returns nil, which is impossible to tell
    # apart from "no such channel" at the controller level). Fall back to a Ruby-side filter
    # so a re-link always finds the channel even when the @> operator is unreliable.
    fallback = Channel::Whatsapp.where(provider: 'openwa').to_a.find do |c|
      c.provider_config.is_a?(Hash) && c.provider_config['session_id'] == session_id
    end
    Rails.logger.warn "[OPENWA] find_channel JSONB query returned nil; fell back to Ruby scan for session=#{session_id} result=#{fallback&.id}" if fallback
    fallback
  end

  def valid_signature?(raw_body, channel)
    # Chambeabot: prefer the env-level OPENWA_WEBHOOK_SECRET so the secret
    # stays in sync with what the OpenWA instance was configured with. The
    # channel's per-row webhook_secret was generated by the original
    # `register_webhook` call but drifted when the session was re-linked
    # without re-running the controller — using the env keeps the HMAC
    # consistent across redeploys and manual webhook re-registrations.
    secret = ENV['OPENWA_WEBHOOK_SECRET'].presence ||
             channel.provider_config['webhook_secret'].presence
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