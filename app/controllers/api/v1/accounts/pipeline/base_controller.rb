class Api::V1::Accounts::Pipeline::BaseController < Api::V1::Accounts::BaseController
  before_action :ensure_administrator

  private

  def ensure_administrator
    return if @current_user&.administrator?

    render json: { error: 'Administrator privileges required' }, status: :forbidden
  end

  # Returns the configured pipeline_stage list for the account, or a sensible
  # default if no CustomAttributeDefinition exists yet.
  def pipeline_stages
    definition = Current.account.custom_attribute_definitions
                  .where(attribute_model: :contact_attribute, attribute_key: 'pipeline_stage')
                  .first

    if definition&.attribute_values.is_a?(Array) && definition.attribute_values.any?
      return definition.attribute_values.map(&:to_s)
    end

    # Default Mexican SMB funnel — used when the operator hasn't set up
    # a custom list yet. Matches the labels the Chambeabot marketing site
    # promises in the landing page.
    %w[nuevo contactado calificado cita-agendada propuesta enviada ganado perdido]
  end

  def stage_color_map
    {
      'nuevo' => '#3B82F6',           # blue-500
      'contactado' => '#8B5CF6',      # violet-500
      'calificado' => '#F59E0B',      # amber-500
      'cita-agendada' => '#06B6D4',   # cyan-500
      'propuesta-enviada' => '#F97316', # orange-500
      'ganado' => '#10B981',          # emerald-500
      'perdido' => '#EF4444'          # red-500
    }
  end
end
