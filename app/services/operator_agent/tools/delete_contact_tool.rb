class OperatorAgent::Tools::DeleteContactTool < OperatorAgent::Tools::BaseTool
  description 'Delete a contact and all their conversations. DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :contact_id, type: 'integer', desc: 'The ID of the contact to delete', required: true

  def perform(tool_context, contact_id:)
    contact = account_scoped(Contact).find_by(id: contact_id)
    return err("Contact ##{contact_id} not found.") unless contact

    conv_count = contact.conversations.count

    if !confirmed?(tool_context)
      return pending(
        'delete_contact',
        { contact_id: contact_id },
        "Eliminar contact ##{contact.id} '#{contact.name}' y todas sus conversaciones (#{conv_count}). Esta acción NO se puede deshacer."
      )
    end

    log_tool_usage('delete_contact', contact_id: contact.id, conversations_affected: conv_count)
    contact.destroy!

    "✅ Contact '##{contact.id} #{contact.name}' eliminado. #{conv_count} conversación(es) afectada(s)."
  rescue StandardError => e
    err("Failed to delete contact: #{e.message}")
  end
end
