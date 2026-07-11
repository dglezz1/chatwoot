# Live-ops proxy for OpenWA — used by the inbox settings dialog to show
# the live QR code + reconnect button. The channel's provider_config
# holds the API key, base URL and session ID.
#
# Inherits from Api::BaseController which uses DeviseTokenAuth + the API
# access token header. Dashboard users authenticate via JWT-cookie headers
# (set by the dashboard axios interceptor) or via the X-Api-Key header.
class Api::V2::Whatsapp::Openwa::LiveOpsController < Api::BaseController
  # DeviseTokenAuth's SetUserByToken concern runs automatically (see
  # ApplicationController) and populates current_user from the dashboard
  # JWT-cookie headers. We skip the parent `authenticate_user!` (which
  # expects a Devise session cookie and 401s for cookie-less API calls)
  # and rely solely on current_user + our admin check.
  skip_before_action :authenticate_user!
  before_action :ensure_administrator
  before_action :set_channel

  # GET /api/v2/whatsapp/openwa/channels/:channel_id  → status payload
  def status
    render json: openwa_client.status
  end

  # POST /api/v2/whatsapp/openwa/channels/:channel_id/start
  def start
    # If the OpenWA session is already started (status=initializing or
    # qr_ready), skip the start POST and just fetch the current QR. This
    # makes the endpoint idempotent — re-clicking "Connect / show QR"
    # from the dialog no longer returns a confusing 500.
    status = openwa_client.status
    unless %w[initializing qr_ready].include?(status[:status])
      openwa_client.start!
      sleep 6 # give the WAWebJS client a moment to initialize
    end
    render json: openwa_client.qr || { qrCode: nil, message: 'session has no QR yet' }
  end

  # POST /api/v2/whatsapp/openwa/channels/:channel_id/stop
  def stop
    render json: openwa_client.stop!
  end

  # GET /api/v2/whatsapp/openwa/channels/:channel_id/qr
  def qr
    result = openwa_client.qr
    if result.nil?
      # Already authenticated — return current status so the UI can flip
      # its display back to "Connected".
      render json: { qrCode: nil, status: openwa_client.status }
    else
      render json: result
    end
  end

  private

  def ensure_administrator
    user = current_user
    return if user.nil?

    # Allow if user is admin on ANY account they belong to, or is a global
    # super admin. The route does not require /accounts/:account_id.
    is_admin = user.account_users.where(role: 'administrator').exists?
    is_super_admin = user.type == 'SuperAdmin'
    return if is_admin || is_super_admin

    render json: { error: 'Administrator role required' }, status: :forbidden
  end

  def set_channel
    @channel = Channel::Whatsapp.find_by(id: params[:channel_id], provider: 'openwa')
    return if @channel

    render json: { error: 'OpenWA channel not found' }, status: :not_found
  end

  def openwa_client
    @openwa_client ||= Whatsapp::Openwa::Client.new(
      api_base_url: @channel.provider_config['api_base_url'],
      api_key: @channel.provider_config['api_key'],
      session_id: @channel.provider_config['session_id']
    )
  end
end
