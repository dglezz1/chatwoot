class OperatorAgent::Tools::CreateAutomationRuleTool < OperatorAgent::Tools::BaseTool
  description 'Create a new automation rule (event → conditions → actions).'

  param :name, type: 'string', desc: 'Human-readable name for the rule', required: true
  param :event_name, type: 'string', desc: 'Event to listen to (e.g. "conversation_created", "conversation_updated", "message_created")', required: true
  param :conditions, type: 'array', desc: 'Array of conditions, e.g. [{"attribute_key":"status","filter_operator":"equal_to","values":["open"]}]', required: true
  param :actions, type: 'array', desc: 'Array of actions, e.g. [{"action_name":"add_label","action_params":["vip"]}]', required: true
  param :description, type: 'string', desc: 'Optional description', required: false

  def perform(_tool_context, name:, event_name:, conditions:, actions:, description: nil)
    if name.blank? || event_name.blank?
      return err('name and event_name are required.')
    end

    rule = account_scoped(AutomationRule).create!(
      name: name,
      event_name: event_name,
      conditions: conditions,
      actions: actions,
      description: description,
      account_id: @account.id
    )

    log_tool_usage('create_automation_rule', id: rule.id)
    "✅ Automation rule creada: ##{rule.id} '#{rule.name}' (event: #{event_name})"
  rescue StandardError => e
    err("Failed to create automation rule: #{e.message}")
  end
end
