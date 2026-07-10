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
class Api::LeadsController < ActionController::API
  # Don't wrap — we want top-level keys (name, email, ...) directly on params,
  # not nested under an api_leads key (the marketing site already sends flat JSON).
  wrap_parameters format: []

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

  # Open a new conversation for the lead. We reuse the first non-widget API
  # inbox if available (Channel::Whatsapp / Channel::Api) since WebWidget
  # inboxes don't accept incoming messages. As a fallback we create a
  # generic "Web Leads" inbox with an Api channel (lighter than WebWidget
  # for lead capture; doesn't need pre-chat form widgets).
  def open_lead_conversation(account, contact, attrs)
    inbox = pick_leads_inbox(account)

    contact_inbox = inbox.contact_inboxes.find_or_create_by!(source_id: contact.id) do |ci|
      ci.contact = contact
    end

    conversation = inbox.conversations.create!(
      account:         account,
      contact:         contact,
      contact_inbox:   contact_inbox,
      status:          :open,
      additional_attributes: {
        source: 'chambeabot.com',
        plan:   attrs[:plan],
        company: attrs[:company]
      }
    )

    # Seed the conversation with an *outgoing* private note so the sales
    # team has a clear summary on the right pane, and the public thread
    # stays empty (the lead hasn't actually messaged us yet).
    body = format_lead_message(attrs)
    Messages::MessageBuilder.new(
      user_or_bot(account),
      conversation,
      {
        content:      body,
        message_type: 'outgoing',
        private:      true
      }
    ).perform
    conversation
  end

  # Pick an inbox for the lead. We prefer the first non-widget API inbox
  # (WhatsApp, Instagram, etc.) so the lead is part of the same workflow
  # as real inbound conversations. Fall back to creating an Api-channel
  # inbox specifically for web leads.
  def pick_leads_inbox(account)
    account.inboxes.where.not(channel_type: 'Channel::WebWidget').first ||
      create_api_leads_inbox(account)
  end

  def create_api_leads_inbox(account)
    api_channel = Channel::Api.create!(account: account)
    Inbox.create!(account: account, channel: api_channel, name: 'Web Leads')
  end

  # Pick a system "sender" for the seeded private note — first admin or
  # the first agent. If neither exists, build a system message by
  # leaving sender nil (the message still saves as a contact-attributed
  # outgoing message).
  def user_or_bot(account)
    account.administrators.first || account.agents.first
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
end

