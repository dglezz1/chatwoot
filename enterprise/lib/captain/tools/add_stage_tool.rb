class Captain::Tools::AddStageTool < Captain::Tools::BasePublicTool
  # Moves a contact through the sales pipeline by setting the
  # `stage` custom_attribute on the contact profile. The valid
  # stages come from the account's `CustomAttributeDefinition`
  # of type `list` with attribute_key = 'pipeline_stage'
  # (or the first list-typed contact_attribute if none is named).
  #
  # If the contact already has a stage, the tool logs the transition
  # (from -> to) to the private captain activity timeline so
  # operators can audit the autonomous moves Captain makes.
  description 'Move a contact to a pipeline stage (e.g. nuevo, calificado, cita agendada, ganado, perdido). ' \
              'Use this whenever the prospect shows clear intent to advance through the funnel.'
  param :stage, type: 'string',
        desc: 'The stage to move the contact to. Must be one of the account\'s configured pipeline stages.'

  def perform(tool_context, stage:)
    contact = find_contact(tool_context.state)
    return 'Contact not found' unless contact

    stage = stage.to_s.strip.downcase
    return 'Stage value is required' if stage.blank?

    valid_stages = pipeline_stages
    return "No pipeline_stage custom_attribute is configured for this account. " \
           "Create one in Settings → Attributes (type: list, key: pipeline_stage)." if valid_stages.blank?

    return "Invalid stage '#{stage}'. Valid stages: #{valid_stages.join(', ')}" unless valid_stages.include?(stage)

    previous_stage = contact.custom_attributes['pipeline_stage']
    log_tool_usage('add_stage',
                   contact_id: contact.id,
                   from: previous_stage,
                   to: stage)

    apply_stage(contact, stage, previous_stage)
    "Contact #{contact.name} moved to stage '#{stage}'" \
      "#{" (from '#{previous_stage}')" if previous_stage.present? && previous_stage != stage}"
  rescue StandardError => e
    ChatwootExceptionTracker.new(e).capture_exception
    "Failed to move contact to stage '#{stage}': #{e.message}"
  end

  private

  def pipeline_stages
    definition = account_scoped(::CustomAttributeDefinition)
                  .where(attribute_model: :contact_attribute, attribute_key: 'pipeline_stage')
                  .first
    return [] if definition.blank?

    Array(definition.attribute_values).map { |v| v.to_s.downcase }.reject(&:blank?)
  end

  def apply_stage(contact, stage, previous_stage)
    contact.custom_attributes = contact.custom_attributes.merge('pipeline_stage' => stage)
    contact.save!

    append_stage_activity(contact, stage, previous_stage)
  end

  def append_stage_activity(contact, stage, previous_stage)
    return unless contact.respond_to?(:activities)

    # Audit log on the contact timeline so operators can see when and
    # why Captain moved the prospect autonomously.
    contact.activities.create!(
      account: @assistant.account,
      user: nil,
      action: 'custom_attribute_updated',
      metadata: {
        custom_attribute_key: 'pipeline_stage',
        from: previous_stage,
        to: stage,
        moved_by: 'captain',
        assistant_id: @assistant.id,
        assistant_name: @assistant.name
      }
    )
  rescue StandardError
    # Activity logging is best-effort; don't fail the stage update if it errors.
    nil
  end

  def permissions
    %w[contact_manage]
  end
end
