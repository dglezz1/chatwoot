class OperatorAgent::Tools::CreateLabelTool < OperatorAgent::Tools::BaseTool
  description 'Create a new conversation label. Non-destructive.'

  param :name, type: 'string', desc: 'Label title (will be lowercased)', required: true
  param :color, type: 'string', desc: 'Optional hex color (e.g. #ff0000)', required: false
  param :description, type: 'string', desc: 'Optional description', required: false

  def perform(_tool_context, name:, color: nil, description: nil)
    name = name.to_s.strip.downcase
    return err('Label name is required.') if name.blank?

    existing = account_scoped(Label).find_by(title: name)
    return ok("Label '#{name}' ya existe (##{existing.id}).") if existing

    label = account_scoped(Label).create!(
      title: name,
      color: color.presence || '#808080',
      description: description
    )

    log_tool_usage('create_label', label_id: label.id)
    "✅ Label '#{name}' creada (##{label.id})."
  rescue StandardError => e
    err("Failed to create label: #{e.message}")
  end
end
