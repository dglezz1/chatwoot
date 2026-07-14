class OperatorAgent::Tools::ConfigurePipelineTool < OperatorAgent::Tools::BaseTool
  description 'Configure the Kanban pipeline for this account by creating (or updating) the `pipeline_stage` custom attribute with the given list of stages. This is what the /pipeline page reads.'
  def self.destructive?
    true
  end

  param :stages, type: 'array', desc: 'Array of stage names in order, e.g. ["nuevo", "contactado", "calificado", "ganado", "perdido"]', required: true
  param :inbox_id, type: 'integer', desc: 'Optional inbox ID to scope the pipeline to. If omitted, the pipeline applies account-wide.', required: false

  def perform(tool_context, stages:, inbox_id: nil)
    if !stages.is_a?(Array) || stages.empty?
      return err('stages must be a non-empty array of strings.')
    end
    if stages.any? { |s| s.to_s.strip.empty? }
      return err('All stage names must be non-empty strings.')
    end

    existing = CustomAttributeDefinition.where(account_id: @account.id, attribute_key: 'pipeline_stage', attribute_model: 1).first
    current_values = existing&.attribute_values || []

    if existing && existing.attribute_values.sort == stages.map(&:to_s).sort
      return ok("Pipeline ya configurado con esos stages: #{stages.join(' → ')}")
    end

    if !confirmed?(tool_context)
      change_desc = if existing
        "Stages actuales: #{current_values.join(', ')}. Cambiar a: #{stages.join(', ')}"
      else
        "Crear nuevo pipeline_stage con stages: #{stages.join(', ')}"
      end
      return pending(
        'configure_pipeline',
        { stages: stages, inbox_id: inbox_id },
        change_desc
      )
    end

    if existing
      existing.update!(attribute_values: stages.map(&:to_s))
      log_tool_usage('configure_pipeline_update', id: existing.id, stages: stages)
      "✅ Pipeline actualizado (##{existing.id}): #{stages.join(' → ')}"
    else
      attr = CustomAttributeDefinition.create!(
        account_id: @account.id,
        attribute_key: 'pipeline_stage',
        attribute_model: 1, # contact_attribute
        attribute_display_name: 'Pipeline Stage',
        attribute_display_type: 6, # list
        attribute_values: stages.map(&:to_s)
      )
      log_tool_usage('configure_pipeline_create', id: attr.id, stages: stages)
      "✅ Pipeline creado (##{attr.id}): #{stages.join(' → ')}"
    end
  rescue StandardError => e
    err("Failed to configure pipeline: #{e.message}")
  end
end
