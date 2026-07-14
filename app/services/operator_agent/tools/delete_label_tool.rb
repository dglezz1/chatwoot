class OperatorAgent::Tools::DeleteLabelTool < OperatorAgent::Tools::BaseTool
  description 'Delete a label and remove it from all conversations. DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :label_id, type: 'integer', desc: 'The ID of the label to delete', required: true

  def perform(tool_context, label_id:)
    label = account_scoped(Label).find_by(id: label_id)
    return err("Label ##{label_id} not found.") unless label

    conv_count = label.conversations.count

    if !confirmed?(tool_context)
      return pending(
        'delete_label',
        { label_id: label_id },
        "Eliminar label ##{label.id} '#{label.title}' (afecta #{conv_count} conversación(es))"
      )
    end

    log_tool_usage('delete_label', label_id: label.id, conversations_affected: conv_count)
    label.destroy!

    "✅ Label '##{label.id} #{label.title}' eliminada. #{conv_count} conversación(es) afectada(s)."
  rescue StandardError => e
    err("Failed to delete label: #{e.message}")
  end
end
