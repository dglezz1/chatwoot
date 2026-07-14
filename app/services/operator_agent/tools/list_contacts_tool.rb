class OperatorAgent::Tools::ListContactsTool < OperatorAgent::Tools::BaseTool
  description 'List contacts in the account. Optionally search by name, email, or phone number (partial match, case-insensitive).'
  param :query, type: 'string', desc: 'Optional search query (matches name, email, phone_number)', required: false
  param :limit, type: 'integer', desc: 'Max results to return (default 50, max 200)', required: false

  def perform(_tool_context, query: nil, limit: 50)
    limit = limit.to_i.clamp(1, 200)

    scope = account_scoped(Contact)
    if query.present?
      like = "%#{query}%"
      scope = scope.where('contacts.name ILIKE ? OR contacts.email ILIKE ? OR contacts.phone_number ILIKE ? OR contacts.identifier ILIKE ?', like, like, like, like)
    end

    contacts = scope.order(updated_at: :desc).limit(limit)

    if contacts.empty?
      return ok("No contacts found#{query ? " matching '#{query}'" : ''}.")
    end

    lines = contacts.map do |c|
      label = c.name.presence || c.identifier.presence || c.email.presence || c.phone_number.presence || "(unnamed)"
      details = [c.email, c.phone_number, c.identifier].compact_blank.uniq.join(' / ')
      "##{c.id} | #{label} | #{details.presence || '(no contact info)'}"
    end

    ok("#{contacts.size} contact(s) found:\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list contacts: #{e.message}")
  end
end
