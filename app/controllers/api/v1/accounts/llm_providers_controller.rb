class Api::V1::Accounts::LlmProvidersController < Api::V1::Accounts::BaseController
  before_action :ensure_administrator
  before_action :fetch_provider, only: [:show, :update, :destroy, :set_default, :validate]

  # GET /api/v1/accounts/:account_id/llm_providers
  def index
    providers = Current.account.llm_provider_settings.ordered
    render json: providers.map { |p| serialize(p) }
  end

  # GET /api/v1/accounts/:account_id/llm_providers/available
  # Returns the list of provider presets (label, default api_base, etc.)
  # that the UI uses to render the "Add new provider" form.
  def available
    render json: LlmProviderSetting::PROVIDERS.map do |slug|
      defaults = LlmProviderSetting::PROVIDER_DEFAULTS[slug] || {}
      {
        slug: slug,
        label: defaults['label'] || slug.split('_').map(&:capitalize).join(' '),
        api_base: defaults['api_base'],
        default_chat_model: defaults['chat_model'],
        default_vision_model: defaults['vision_model'],
        default_audio_transcription_model: defaults['audio_transcription_model'],
        default_embedding_model: defaults['embedding_model'],
        capabilities: defaults['capabilities'] || {}
      }
    end
  end

  # POST /api/v1/accounts/:account_id/llm_providers
  def create
    settings = Current.account.llm_provider_settings.new(create_params)
    if settings.save
      # Validate the credentials in the background — the response returns
      # the persisted record immediately, and a `last_validated_at` /
      # `last_validation_error` pair is updated asynchronously.
      Llm::ProviderValidationJob.perform_later(settings.id)
      render json: serialize(settings), status: :created
    else
      render json: { errors: settings.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/accounts/:account_id/llm_providers/:id
  def show
    render json: serialize(@provider, include_api_key: true)
  end

  # PATCH /api/v1/accounts/:account_id/llm_providers/:id
  def update
    if @provider.update(update_params)
      @provider.update!(last_validated_at: nil, last_validation_error: nil)
      Llm::ProviderValidationJob.perform_later(@provider.id)
      render json: serialize(@provider, include_api_key: true)
    else
      render json: { errors: @provider.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/accounts/:account_id/llm_providers/:id
  def destroy
    @provider.destroy!
    head :no_content
  end

  # POST /api/v1/accounts/:account_id/llm_providers/:id/set_default
  def set_default
    @provider.update!(is_default: true)
    render json: serialize(@provider)
  end

  # POST /api/v1/accounts/:account_id/llm_providers/:id/validate
  # Synchronously tests the credentials by calling /models on the provider.
  # Returns { ok: true, model_count: N } or { ok: false, error: "..." }.
  def validate
    result = Llm::ProviderValidator.new(@provider).validate
    if result[:ok]
      @provider.update!(last_validated_at: Time.current, last_validation_error: nil)
    else
      @provider.update!(last_validation_error: result[:error])
    end
    render json: result
  end

  private

  def ensure_administrator
    return if @current_user&.administrator?

    render json: { error: 'Administrator privileges required' }, status: :forbidden
  end

  def fetch_provider
    @provider = Current.account.llm_provider_settings.find(params[:id])
  end

  def create_params
    params.permit(
      :provider, :label, :api_base, :api_key,
      :chat_model, :vision_model, :audio_transcription_model, :embedding_model,
      :enabled, :is_default,
      capabilities: {}, config: {}
    )
  end

  def update_params
    params.permit(
      :label, :api_base, :api_key,
      :chat_model, :vision_model, :audio_transcription_model, :embedding_model,
      :enabled, :is_default,
      capabilities: {}, config: {}
    )
  end

  def serialize(provider, include_api_key: false)
    payload = {
      id: provider.id,
      provider: provider.provider,
      label: provider.label.presence || LlmProviderSetting::PROVIDER_DEFAULTS.dig(provider.provider, 'label'),
      api_base: provider.api_base,
      chat_model: provider.chat_model,
      vision_model: provider.vision_model,
      audio_transcription_model: provider.audio_transcription_model,
      embedding_model: provider.embedding_model,
      capabilities: provider.capabilities,
      enabled: provider.enabled,
      is_default: provider.is_default,
      last_used_at: provider.last_used_at,
      last_validated_at: provider.last_validated_at,
      last_validation_error: provider.last_validation_error,
      created_at: provider.created_at,
      updated_at: provider.updated_at
    }
    payload[:api_key_masked] = mask_api_key(provider.api_key) if provider.api_key.present?
    payload[:api_key] = provider.api_key if include_api_key
    payload
  end

  def mask_api_key(api_key)
    return nil if api_key.blank?
    return '••••••••' if api_key.length <= 8

    "#{api_key[0, 4]}•••••••#{api_key[-4, 4]}"
  end
end
