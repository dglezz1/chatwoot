class OperatorAgent::Tools::UpdateContactTool < OperatorAgent::Tools::BaseTool
  description 'Update an existing contact (name, email, phone, custom attributes). DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :contact_id, type: 'integer', desc: 'The ID of the contact to update', required: true
  param :name, type: 'string', desc: 'New name', required: false
  param :email, type: 'string', desc: 'New email', required: false
  param :phone_number, type: 'string', desc: 'New phone number', required: false
  param :custom_attributes, type: 'object', desc: 'Custom attribute key-value pairs to merge (e.g. {"plan": "premium", "company": "Acme"})', required: false

  def perform(tool_context, contact_id:, name: nil, email: nil, phone_number: nil, custom_attributes: nil)
    contact = account_scoped(Contact).find_by(id: contact_id)
    return err("Contact ##{contact_id} not found.") unless contact

    changes = {}
    changes[:name] = name if name.present? && name != contact.name
    changes[:email] = email if email.present? && email != contact.email
    changes[:phone_number] = phone_number if phone_number.present? && phone_number != contact.phone_number

    if custom_attributes.is_a?(Hash) && custom_attributes.any?
      merged = (contact.custom_attributes || {}).merge(custom_attributes.stringify_keys)
      changes[:custom_attributes] = merged if merged != contact.custom_attributes
    end

    if changes.empty?
      return ok("Sin cambios. Contact ##{contact.id} ya tiene esos valores.")
    end

    if !confirmed?(tool_context)
      return pending(
        'update_contact',
        { contact_id: contact_id, name: name, email: email, phone_number: phone_number, custom_attributes: custom_attributes },
        "Actualizar contact ##{contact.id} ('#{contact.name}') → #{changes.map { |k, v| "#{k}: #{v.inspect}" }.join(', ')}"
      )
    end

    log_tool_usage('update_contact', contact_id: contact_id, changes: changes.keys)
    contact.update!(changes)

    "Contact ##{contact.id} actualizado: #{changes.keys.join(', ')}"
  rescue StandardError => e
    err("Failed to update contact: #{e.message}")
  end
end
