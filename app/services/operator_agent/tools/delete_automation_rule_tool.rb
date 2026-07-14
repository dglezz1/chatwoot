class OperatorAgent::Tools::DeleteAutomationRuleTool < OperatorAgent::Tools::BaseTool
  description 'Delete an automation rule. DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :rule_id, type: 'integer', desc: 'The ID of the automation rule to delete', required: true

  def perform(tool_context, rule_id:)
    rule = account_scoped(AutomationRule).find_by(id: rule_id)
    return err("Automation rule ##{rule_id} not found.") unless rule

    if !confirmed?(tool_context)
      return pending(
        'delete_automation_rule',
        { rule_id: rule_id },
        "Eliminar automation rule ##{rule.id} '#{rule.name}' (event: #{rule.event_name})"
      )
    end

    log_tool_usage('delete_automation_rule', id: rule.id)
    rule.destroy!
    "✅ Automation rule '##{rule.id} #{rule.name}' eliminada."
  rescue StandardError => e
    err("Failed to delete automation rule: #{e.message}")
  end
end
