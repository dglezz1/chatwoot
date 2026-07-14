class OperatorAgent::Tools::MoveContactToStageTool < OperatorAgent::Tools::BaseTool
  description 'Move a contact to a configured pipeline stage. Adds an entry to the contact activity timeline. Non-destructive (reversible).'

  param :contact_id, type: 'integer', desc: 'The contact ID to move', required: true
  param :stage, type: 'string', desc: 'The stage name (must be in the pipeline_stage custom attribute values)', required: true
  param :note, type: 'string', desc: 'Optional internal note explaining the move', required: false

  def perform(_tool_context, contact_id:, stage:, note: nil)
    contact = account_scoped(Contact).find_by(id: contact_id)
    return err("Contact ##{contact_id} not found.") unless contact

    pipeline_attr = CustomAttributeDefinition.where(account_id: @account.id, attribute_key: 'pipeline_stage', attribute_model: 1).first
    if pipeline_attr.nil?
      return err("No hay pipeline configurado. Usa configure_pipeline primero.")
    end
    unless pipeline_attr.attribute_values.include?(stage)
      return err("Stage '#{stage}' no está en el pipeline configurado. Stages disponibles: #{pipeline_attr.attribute_values.join(', ')}")
    end

    old_stage = contact.custom_attributes&.dig('pipeline_stage')
    contact.custom_attributes = (contact.custom_attributes || {}).merge('pipeline_stage' => stage)
    contact.save!

    # Audit on the contact activity timeline
    contact.activities.create!(
      action: 'pipeline_stage_changed',
      content: "Moved from '#{old_stage}' to '#{stage}'#{note.present? ? " — #{note}" : ''}",
      user: @user
    )

    log_tool_usage('move_contact_to_stage', contact_id: contact.id, from: old_stage, to: stage)
    "✅ Contact ##{contact.id} '#{contact.name}' movido de '#{old_stage}' a '#{stage}'."
  rescue StandardError => e
    err("Failed to move contact: #{e.message}")
  end
end
