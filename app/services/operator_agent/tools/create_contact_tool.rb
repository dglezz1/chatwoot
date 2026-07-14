class OperatorAgent::Tools::CreateContactTool < OperatorAgent::Tools::BaseTool
  description 'Create a new contact in the account. Not destructive (adds a row, no impact on existing records).'

  param :name, type: 'string', desc: 'Full name', required: true
  param :email, type: 'string', desc: 'Email address (optional)', required: false
  param :phone_number, type: 'string', desc: 'Phone number in E.164 format (e.g. +525512345678)', required: false
  param :inbox_id, type: 'integer', desc: 'Optional inbox ID to also create a ContactInbox for (so the contact can be reached on that channel)', required: false

  def perform(_tool_context, name:, email: nil, phone_number: nil, inbox_id: nil)
    if name.blank?
      return err('Name is required.')
    end

    contact = account_scoped(Contact).create!(
      name: name,
      email: email,
      phone_number: phone_number,
      identifier: phone_number.presence || email
    )

    if inbox_id.present?
      inbox = account_scoped(Inbox).find_by(id: inbox_id)
      if inbox
        ContactInbox.create!(
          contact: contact,
          inbox: inbox,
          source_id: phone_number.presence || email.presence || SecureRandom.uuid
        )
      end
    end

    log_tool_usage('create_contact', contact_id: contact.id)
    "✅ Contacto creado: ##{contact.id} (#{contact.name}) — email: #{email || '—'}, phone: #{phone_number || '—'}"
  rescue StandardError => e
    err("Failed to create contact: #{e.message}")
  end
end
