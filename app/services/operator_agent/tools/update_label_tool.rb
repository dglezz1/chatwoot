class OperatorAgent::Tools::UpdateLabelTool < OperatorAgent::Tools::BaseTool
  description 'Update an existing label (name, color, description). DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :label_id, type: 'integer', desc: 'The ID of the label to update', required: true
  param :name, type: 'string', desc: 'New title for the label', required: false
  param :color, type: 'string', desc: 'New color (hex code like #ff0000)', required: false
  param :description, type: 'string', desc: 'New description for the label', required: false

  def perform(tool_context, label_id:, name: nil, color: nil, description: nil)
    label = account_scoped(Label).find_by(id: label_id)
    return err("Label ##{label_id} not found.") unless label

    changes = {}
    changes[:title] = name if name.present? && name != label.title
    changes[:color] = color if color.present? && color != label.color
    changes[:description] = description if description.present? && description != label.description

    if changes.empty?
      return ok("Sin cambios. Label ##{label.id} ('#{label.title}') ya tiene esos valores.")
    end

    if !confirmed?(tool_context)
      return pending(
        'update_label',
        { label_id: label_id, name: name, color: color, description: description },
        "Actualizar label ##{label.id} '#{label.title}' → #{changes.map { |k, v| "#{k}: '#{v}'" }.join(', ')}"
      )
    end

    log_tool_usage('update_label', label_id: label_id, changes: changes)
    label.update!(changes)

    "Label ##{label.id} actualizada: #{changes.map { |k, v| "#{k}: '#{v}'" }.join(', ')}"
  rescue StandardError => e
    err("Failed to update label: #{e.message}")
  end
end
