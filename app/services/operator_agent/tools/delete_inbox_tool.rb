class OperatorAgent::Tools::DeleteInboxTool < OperatorAgent::Tools::BaseTool
  description 'Delete an inbox and all its conversations. DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :inbox_id, type: 'integer', desc: 'The ID of the inbox to delete', required: true

  def perform(tool_context, inbox_id:)
    inbox = account_scoped(Inbox).find_by(id: inbox_id)
    return err("Inbox ##{inbox_id} not found.") unless inbox

    conv_count = inbox.conversations.count

    if !confirmed?(tool_context)
      return pending(
        'delete_inbox',
        { inbox_id: inbox_id },
        "Eliminar inbox ##{inbox.id} '#{inbox.name}' y todas sus conversaciones (#{conv_count}). Esta acción NO se puede deshacer."
      )
    end

    log_tool_usage('delete_inbox', inbox_id: inbox.id, conversations_affected: conv_count)
    inbox.destroy!

    "✅ Inbox '##{inbox.id} #{inbox.name}' eliminado. #{conv_count} conversación(es) afectada(s)."
  rescue StandardError => e
    err("Failed to delete inbox: #{e.message}")
  end
end
