# Public endpoint hit by the marketing site (chambeabot.com) to capture leads.
#
# POST /api/leads
#   Body (JSON): { name, email, phone, company, plan, message }
#   Returns 201 { contact_id, conversation_id } on success.
#
# The endpoint is intentionally *unauthenticated*. It picks a single account
# (the first one, since Chambeabot is single-tenant on this deploy) and a
# designated lead inbox ("Web Leads" — we create one lazily if missing) and
# pushes the lead into the same inbox a WhatsApp conversation would land in,
# so the sales team sees it alongside everything else in the dashboard.
class Api::LeadsController < ActionController::Base
  respond_to :json
  protect_from_forgery with: :null_session
  skip_before_action :verify_authenticity_token

  # Permissive CORS so the marketing domain (chambeabot.com) can POST even when
  # the API host is crm.chambeabot.com. We don't accept credentials.
  before_action :set_cors_headers
  def set_cors_headers
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
  end

  # Lightweight rate-limit: one lead per IP per 30s. In-memory only; good enough
  # for the marketing site, swap for Redis if you scale.
  before_action :throttle
  def throttle
    @last_seen = Rails.cache.read("lead:#{request.remote_ip}")
    return if @last_seen.nil? || @last_seen < 30.seconds.ago

    render json: { error: 'Demasiadas solicitudes, intenta en un momento.' },
           status: :too_many_requests
  end

  # Always answer CORS preflight quickly.
  def preflight
    head :ok
  end

  def create
    params.require(%i[name email phone])

    account = Account.first
    return render(json: { error: 'No account configured' }, status: :unprocessable_entity) if account.nil?

    contact = find_or_create_contact(account, lead_params)

    conversation = open_lead_conversation(account, contact, lead_params)

    render json: { contact_id: contact.id, conversation_id: conversation&.id },
           status: :created
  end

  private

  def lead_params
    params.permit(:name, :email, :phone, :company, :plan, :message)
  end

  # Find an existing contact by email or phone (dedupe). Otherwise create one.
  def find_or_create_contact(account, attrs)
    found = account.contacts.find_by('lower(email) = ?', attrs[:email].to_s.downcase) if attrs[:email].present?
    found ||= account.contacts.find_by(phone_number: attrs[:phone]) if attrs[:phone].present?
    return found if found

    account.contacts.create!(
      name:        attrs[:name].to_s.strip.presence || 'Lead Web',
      email:       attrs[:email],
      phone_number: attrs[:phone],
      custom_attributes: {
        'company'    => attrs[:company],
        'plan'       => attrs[:plan],
        'source'     => 'chambeabot.com',
        'lead_kind'  => 'lead_website'
      }
    )
  end

  # Open a new conversation for the lead against a "Web Leads" inbox (we
  # create one lazily). The first incoming message seeds the conversation so
  # the sales team has something to read on the right pane.
  def open_lead_conversation(account, contact, attrs)
    inbox = account.inboxes.find_by(name: 'Web Leads') ||
            create_web_leads_inbox(account)

    conversation = inbox.conversations.create!(
      account:   account,
      contact:   contact,
      status:    :open,
      additional_attributes: { source: 'chambeabot.com', plan: attrs[:plan] }
    )

    body = format_lead_message(attrs)
    Messages::MessageBuilder.new(
      nil,
      conversation,
      {
        content:      body,
        message_type: 'incoming',
        private:      false
      }
    ).perform
    conversation
  end

  def format_lead_message(attrs)
    lines = ["🌐 Lead desde chambeabot.com", "Nombre: #{attrs[:name]}"]
    lines << "Email: #{attrs[:email]}"
    lines << "WhatsApp: #{attrs[:phone]}"
    lines << "Empresa: #{attrs[:company]}" if attrs[:company].present?
    lines << "Plan de interés: #{attrs[:plan]}" if attrs[:plan].present?
    lines << ''
    lines << (attrs[:message].presence || '(sin mensaje)')
    lines.join("\n")
  end

  # A dedicated Channel::WebWidget inbox for leads. We only create it once;
  # the find_by(name:) above caches it after that.
  def create_web_leads_inbox(account)
    web_widget = Channel::WebWidget.create!(
      account:     account,
      website_url: 'https://chambeabot.com'
    )
    Inbox.create!(
      account: account,
      channel: web_widget,
      name:    'Web Leads'
    )
  end
end