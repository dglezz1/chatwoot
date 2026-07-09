class Api::V1::Accounts::Captain::InboxesController < Api::V1::Accounts::BaseController
  before_action :current_account
  before_action -> { check_authorization(Captain::Assistant) }

  before_action :set_assistant
  before_action :set_captain_inbox, only: [:show, :update, :destroy]

  def index
    @inboxes = @assistant.inboxes
  end

  def show
    # Returns the per-inbox config (mode, delays, welcome message, etc.)
    # alongside the assistant's defaults so the UI can show effective values.
  end

  def create
    inbox = Current.account.inboxes.find(assistant_params[:inbox_id])
    @captain_inbox = @assistant.captain_inboxes.build(inbox: inbox)
    @captain_inbox.save!
  end

  def update
    # Persist the per-inbox config (auto-reply mode, delays, debounce window,
    # welcome message override, away message, business hours, handoff keywords).
    new_config = @captain_inbox.config.deep_dup
    cfg_params = config_params.to_h

    # Validate auto_reply_mode against the allowed set
    if cfg_params.key?('auto_reply_mode')
      unless CaptainInbox::AUTO_REPLY_MODES.include?(cfg_params['auto_reply_mode'])
        return render json: { error: "Invalid auto_reply_mode: #{cfg_params['auto_reply_mode']}" }, status: :unprocessable_entity
      end
    end

    # Validate min/max delay — max must be >= min
    new_min = cfg_params['min_response_delay_seconds']&.to_i
    new_max = cfg_params['max_response_delay_seconds']&.to_i
    if new_min && new_max && new_max < new_min
      return render json: { error: 'max_response_delay_seconds must be >= min_response_delay_seconds' }, status: :unprocessable_entity
    end

    # Validate debounce window
    new_debounce = cfg_params['debounce_window_seconds']&.to_i
    if new_debounce && new_debounce < 5
      return render json: { error: 'debounce_window_seconds must be >= 5' }, status: :unprocessable_entity
    end

    # Validate business_hours if present
    if cfg_params.key?('business_hours') && cfg_params['business_hours'].present?
      bh = cfg_params['business_hours']
      if bh.is_a?(ActionController::Parameters)
        bh = bh.to_unsafe_h
      end
      unless bh.is_a?(Hash) && bh['start_hour'].is_a?(Integer) && bh['end_hour'].is_a?(Integer)
        return render json: { error: 'business_hours must include start_hour and end_hour as integers' }, status: :unprocessable_entity
      end
      cfg_params['business_hours'] = bh
    end

    new_config.merge!(cfg_params)
    @captain_inbox.update!(config: new_config)
  end

  def destroy
    @captain_inbox.destroy!
    head :no_content
  end

  private

  def set_assistant
    @assistant = account_assistants.find(params[:assistant_id])
  end

  def set_captain_inbox
    # URL param is :inbox_id (preserved for backward compat with the existing
    # route declaration). We look up the CaptainInbox by the underlying inbox
    # since each inbox can only be linked to one assistant.
    @captain_inbox = @assistant.captain_inboxes.find_by!(inbox_id: params[:inbox_id])
  end

  def account_assistants
    @account_assistants ||= Current.account.captain_assistants
  end

  def config_params
    # Allow the client to send a `config` hash with the per-inbox overrides.
    # Whitelisted keys are merged into the jsonb column.
    permitted = params.permit(
      :assistant_id, :id, :account_id, :inbox_id,
      config: [
        :auto_reply_mode,
        :min_response_delay_seconds,
        :max_response_delay_seconds,
        :debounce_window_seconds,
        :welcome_message,
        :away_message,
        :require_human_acknowledgment,
        :daily_reply_cap,
        { handoff_keywords: [] },
        { block_list: [] },
        { business_hours: [:start_hour, :end_hour, :timezone, { days: [] }] }
      ]
    )
    (permitted[:config] || {}).to_h
  end

  # Keep for backward compat with existing callers (POST /captain/inboxes)
  def assistant_params
    params.require(:inbox).permit(:inbox_id)
  end
end
