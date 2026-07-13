module Llm
  # Resolves the effective LLM provider for an account + feature.
  #
  # Lookup order:
  #   1. Per-account LlmProviderSetting marked is_default=true (operator
  #      has explicitly configured MiniMax, OpenAI, etc.)
  #   2. Per-account LlmProviderSetting (any enabled one)
  #   3. System-wide InstallationConfig (CAPTAIN_OPEN_AI_* env vars)
  #
  # The returned hash contains the api_key, api_base, model, and the
  # provider slug — enough to make a call to the right endpoint.
  class AccountProviderResolver
    PROVIDER_KEYS = {
      'minimax'             => 'CAPTAIN_OPEN_AI_API_KEY',
      'openai'              => 'CAPTAIN_OPEN_AI_API_KEY',
      'openrouter'          => 'CAPTAIN_OPEN_AI_API_KEY',
      'together'            => 'CAPTAIN_OPEN_AI_API_KEY',
      'groq'                => 'CAPTAIN_OPEN_AI_API_KEY',
      'anthropic'           => 'CAPTAIN_ANTHROPIC_API_KEY',
      'gemini'              => 'CAPTAIN_GEMINI_API_KEY',
      'local'               => 'CAPTAIN_OPEN_AI_API_KEY',
      'openai_compatible'   => 'CAPTAIN_OPEN_AI_API_KEY'
    }.freeze

    def self.resolve(feature:, account: nil)
      new(feature: feature, account: account).resolve
    end

    def initialize(feature:, account: nil)
      @feature = feature.to_s
      @account = account
    end

    def resolve
      provider = find_provider

      {
        feature: @feature,
        provider: provider[:slug],
        api_key: provider[:api_key],
        api_base: provider[:api_base]&.chomp('/'),
        model: provider[:model],
        source: provider[:source],
        capabilities: provider[:capabilities] || {}
      }
    end

    private

    def find_provider
      settings = LlmProviderSetting.default_for(@account) if @account
      return account_provider(settings) if settings.present?

      system_provider
    end

    def account_provider(settings)
      effective = settings.effective_settings
      model_key = model_field_for_feature(@feature)
      model = effective[model_key]

      {
        slug: settings.provider,
        api_key: settings.api_key,
        api_base: effective[:api_base],
        model: model,
        source: :account_provider,
        capabilities: effective[:capabilities]
      }
    end

    def system_provider
      endpoint = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value.presence
      api_key = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_API_KEY')&.value.presence
      model = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_MODEL')&.value.presence

      slug = if endpoint&.include?('minimaxi.com') || endpoint&.include?('minimax.com')
               'minimax'
             elsif endpoint.blank? || endpoint.include?('api.openai.com')
               'openai'
             else
               'openai_compatible'
             end

      {
        slug: slug,
        api_key: api_key,
        api_base: endpoint,
        model: model || Llm::Config::DEFAULT_MODEL,
        source: :system_config,
        capabilities: default_capabilities(slug)
      }
    end

    def model_field_for_feature(feature)
      # Maps a feature key to the field on LlmProviderSetting.effective_settings
      # that should be used. Audio uses a separate transcription model;
      # help_center_search uses an embedding model. Everything else uses
      # vision_model if the LLM is multimodal-aware, else chat_model.
      case feature
      when 'audio_transcription' then :audio_transcription_model
      when 'help_center_search'   then :embedding_model
      when 'assistant', 'editor', 'label_suggestion',
           'reply_suggestion', 'summary', 'follow_up', 'rewrite',
           'pdf_faq_generation'
        :chat_model
      else
        :vision_model
      end
    end

    def default_capabilities(slug)
      LlmProviderSetting::PROVIDER_DEFAULTS.dig(slug, 'capabilities') || {}
    end
  end
end
