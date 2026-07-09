class Api::V1::Accounts::Whatsapp::OpenwaController < Api::V1::Accounts::BaseController
  before_action :ensure_admin_or_agent

  # GET /api/v1/accounts/:account_id/whatsapp/openwa/health
  def health
    render json: { status: 'ok', openwa: openwa_api_get('/api/health') }
  end

  # GET /api/v1/accounts/:account_id/whatsapp/openwa/sessions
  def sessions
    response = openwa_api_get('/api/sessions')
    render json: response.parsed_response || []
  end

  # POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions
  # body: { name: "my-session" }
  def create_session
    response = openwa_api_post('/api/sessions', { name: params.require(:name) })
    if response.success?
      render json: response.parsed_response, status: :created
    else
      render json: { error: response.parsed_response }, status: response.code
    end
  end

  # GET /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id/qr
  def qr
    session_id = params[:id]
    response = openwa_api_get("/api/sessions/#{session_id}/qr")
    if response.success?
      payload = response.parsed_response || {}
      render json: {
        session_id: session_id,
        qr_code: payload['qrCode'] || payload[:qrCode],
        status: payload['status'] || payload[:status]
      }
    else
      render json: { error: response.parsed_response }, status: response.code
    end
  end

  # POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id/start
  def start
    session_id = params[:id]
    response = openwa_api_post("/api/sessions/#{session_id}/start", {})
    render json: response.parsed_response, status: response.code
  end

  # POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id/stop
  def stop
    session_id = params[:id]
    response = openwa_api_post("/api/sessions/#{session_id}/stop", {})
    render json: response.parsed_response, status: response.code
  end

  # DELETE /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id
  def destroy
    session_id = params[:id]
    response = openwa_api_delete("/api/sessions/#{session_id}")
    render json: { ok: response.success? }, status: response.code
  end

  # POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id/register_webhook
  # Registers Chatwoot's incoming webhook URL with OpenWA so it forwards
  # message.received events. Idempotent.
  def register_webhook
    session_id = params[:id]
    channel = Channel::Whatsapp.find_by(provider: 'openwa', account_id: @current_account.id)
    secret = SecureRandom.hex(16)

    # Persist secret on channel
    if channel
      channel.provider_config = channel.provider_config.merge('webhook_secret' => secret)
      channel.save!(validate: false)
    end

    chatwoot_url = "#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/webhooks/openwa/#{session_id}"
    body = {
      url: chatwoot_url,
      events: %w[message.received message.sent message.ack message.revoked session.status],
      secret: secret
    }

    response = openwa_api_post("/api/sessions/#{session_id}/webhooks", body)
    if response.success?
      render json: { ok: true, webhook_url: chatwoot_url, secret: secret, openwa_response: response.parsed_response }
    else
      render json: { error: response.parsed_response }, status: response.code
    end
  end

  private

  def ensure_admin_or_agent
    return if @current_user&.administrator? || @current_user&.agent?

    render json: { error: 'Unauthorized' }, status: :unauthorized
  end

  def openwa_api_base
    ENV.fetch('OPENWA_API_BASE_URL', 'http://openwa:2785')
  end

  def openwa_api_key
    ENV['OPENWA_API_KEY'].to_s
  end

  def openwa_headers
    { 'X-API-Key' => openwa_api_key, 'Content-Type' => 'application/json' }
  end

  def openwa_api_get(path)
    HTTParty.get("#{openwa_api_base}#{path}", headers: openwa_headers, timeout: 30)
  end

  def openwa_api_post(path, body)
    HTTParty.post("#{openwa_api_base}#{path}", headers: openwa_headers, body: body.to_json, timeout: 60)
  end

  def openwa_api_delete(path)
    HTTParty.delete("#{openwa_api_base}#{path}", headers: openwa_headers, timeout: 30)
  end
end