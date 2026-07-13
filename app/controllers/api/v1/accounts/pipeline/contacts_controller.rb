class Api::V1::Accounts::Pipeline::ContactsController < Api::V1::Accounts::Pipeline::BaseController
  # GET /api/v1/accounts/:account_id/pipeline/contacts
  #
  # Returns contacts grouped by their `pipeline_stage` custom_attribute.
  # Defaults: contacts without a stage land in 'nuevo'. The response also
  # includes the configured stage list so the UI can render the columns
  # even when a stage has zero contacts.
  #
  # Query params:
  #   - inbox_id (optional) — limit to contacts that have at least one
  #     conversation in this inbox. Useful for the WhatsApp Chambeabot
  #     operator to focus on their own pipeline.
  def index
    stages = pipeline_stages
    scoped = Current.account.contacts
    scoped = scoped.joins(:conversations).where(conversations: { inbox_id: params[:inbox_id] }).distinct if params[:inbox_id].present?

    grouped = scoped.where("custom_attributes ? 'pipeline_stage'")
                    .group_by { |c| c.custom_attributes['pipeline_stage'].to_s }

    # Stage → contacts[] (no body for the request, just id + name + phone + email
    # + last_activity_at + custom_attributes summary; keeps payload small).
    columns = stages.each_with_object({}) do |stage, acc|
      contacts = (grouped[stage] || [])
      acc[stage] = contacts.map { |c| serialize_contact(c) }
    end

    # Anything with an unknown / null stage goes to 'nuevo' so it doesn't
    # disappear from the board.
    orphan_stage = grouped.except(*stages).keys
    if orphan_stage.any?
      orphans = orphan_stage.flat_map { |s| grouped[s] }
      columns['nuevo'] = (columns['nuevo'] + orphans.map { |c| serialize_contact(c) }).uniq { |c| c[:id] }
    end

    render json: {
      stages: stages.map { |s| { key: s, color: stage_color_map[s] } },
      columns: columns,
      total_count: scoped.count
    }
  end

  # PATCH /api/v1/accounts/:account_id/pipeline/contacts/:id
  #
  # Move a contact to a new stage. Validates the stage is in the
  # configured list. Records an activity entry for the audit trail.
  def update
    contact = Current.account.contacts.find(params[:id])
    new_stage = params[:pipeline_stage].to_s.strip.downcase

    return render json: { error: 'pipeline_stage is required' }, status: :unprocessable_entity if new_stage.blank?
    return render json: { error: "Invalid stage '#{new_stage}'. Valid: #{pipeline_stages.join(', ')}" },
                  status: :unprocessable_entity unless pipeline_stages.include?(new_stage)

    previous_stage = contact.custom_attributes['pipeline_stage']
    contact.custom_attributes = contact.custom_attributes.merge('pipeline_stage' => new_stage)
    contact.save!

    # Audit activity
    if contact.respond_to?(:activities)
      contact.activities.create!(
        account: Current.account,
        user: Current.user,
        action: 'custom_attribute_updated',
        metadata: {
          custom_attribute_key: 'pipeline_stage',
          from: previous_stage,
          to: new_stage,
          moved_by: Current.user&.email || 'api'
        }
      )
    end

    render json: { contact: serialize_contact(contact) }
  end

  private

  def serialize_contact(contact)
    {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone_number: contact.phone_number,
      thumbnail: contact.avatar_url,
      last_activity_at: contact.last_activity_at&.iso8601,
      custom_attributes: contact.custom_attributes
    }
  end
end
