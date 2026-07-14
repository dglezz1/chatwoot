module Llm
  # Resolves the effective LLM provider for a feature.
  #
  # The LLM API key is read from environment variables ONLY — never
  # from the database. This is a deliberate security choice: Railway
  # encrypts env vars at rest in the project vault, secrets are
  # rotated in one place, and there's no risk of an ex-employee
  # walking off with a database dump containing active keys.
  #
  # Env vars consumed:
  #   CAPTAIN_OPEN_AI_API_KEY    — required, the API key
  #   CAPTAIN_OPEN_AI_ENDPOINT   — required, e.g. https://api.minimaxi.com/v1
  #   CAPTAIN_OPEN_AI_MODEL      — required, default chat model
  #   CAPTAIN_VISION_MODEL       — optional, vision model (defaults to chat model)
  #   CAPTAIN_AUDIO_MODEL        — optional, audio transcription model
  #   CAPTAIN_EMBEDDING_MODEL    — optional, RAG embedding model
  #   CAPTAIN_PROVIDER_SLUG      — optional, display name (e.g. "minimax")
  #
  # If CAPTAIN_PROVIDER_SLUG is not set, the slug is auto-detected
  # from the endpoint URL (api.minimaxi.com → "minimax",
  # api.openai.com → "openai", everything else → "openai_compatible").
  #
  # The returned hash is the same shape the previous version returned,
  # so callers (audio transcription, image/video, etc.) don't need
  # to change.
  class AccountProviderResolver
    def self.resolve(feature:, account: nil)
      new(feature: feature).resolve
    end

    def initialize(feature:)
      @feature = feature.to_s
    end

    def resolve
      api_key  = ENV['CAPTAIN_OPEN_AI_API_KEY'].to_s
      endpoint = ENV['CAPTAIN_OPEN_AI_ENDPOINT'].to_s
      chat     = ENV['CAPTAIN_OPEN_AI_MODEL'].to_s

      return missing_config_payload if api_key.empty? || endpoint.empty? || chat.empty?

      {
        feature: @feature,
        provider: detect_provider_slug(endpoint),
        api_key: api_key,
        api_base: endpoint.chomp('/'),
        model: model_for_feature(chat),
        source: :env,
        capabilities: capabilities_for(slug: detect_provider_slug(endpoint))
      }
    end

    private

    def detect_provider_slug(endpoint)
      explicit = ENV['CAPTAIN_PROVIDER_SLUG'].to_s
      return explicit if explicit.present?

      host = endpoint.downcase
      return 'minimax'             if host.include?('minimaxi.com') || host.include?('minimax.com')
      return 'openai'              if host.include?('api.openai.com')
      return 'anthropic'           if host.include?('anthropic.com')
      return 'gemini'              if host.include?('googleapis.com') || host.include?('generativelanguage')
      return 'groq'                if host.include?('groq.com')
      return 'openrouter'          if host.include?('openrouter.ai')
      return 'together'            if host.include?('together.xyz')
      return 'local'               if host.include?('localhost') || host.include?('127.0.0.1') || host.start_with?('http://')

      'openai_compatible'
    end

    def model_for_feature(chat_default)
      case @feature
      when 'audio_transcription' then ENV['CAPTAIN_AUDIO_MODEL'].presence || chat_default
      when 'help_center_search'   then ENV['CAPTAIN_EMBEDDING_MODEL'].presence || chat_default
      else
        # Vision-capable LLM calls use the vision model when the
        # provider supports it, falling back to the chat model.
        ENV['CAPTAIN_VISION_MODEL'].presence || chat_default
      end
    end

    # Static capability matrix for the supported providers. Kept here
    # (not in a YAML) so the LlmProviderResolver has zero dependencies
    # and can be called from background jobs without loading the
    # LlmProviderSetting constant (which depends on Rails + the DB).
    def capabilities_for(slug:)
      {
        'minimax'           => { text: true, images: true, audio_input: true, audio_output: true, video: true, tool_calling: true, embeddings: true },
        'openai'            => { text: true, images: true, audio_input: true, audio_output: true, video: false, tool_calling: true, embeddings: true },
        'openrouter'        => { text: true, images: true, audio_input: false, audio_output: false, video: false, tool_calling: true, embeddings: true },
        'together'          => { text: true, images: true, audio_input: true, audio_output: false, video: false, tool_calling: true, embeddings: true },
        'groq'              => { text: true, images: true, audio_input: true, audio_output: false, video: false, tool_calling: true, embeddings: false },
        'anthropic'         => { text: true, images: true, audio_input: false, audio_output: false, video: false, tool_calling: true, embeddings: false },
        'gemini'            => { text: true, images: true, audio_input: true, audio_output: true, video: true, tool_calling: true, embeddings: true },
        'local'             => { text: true, images: false, audio_input: false, audio_output: false, video: false, tool_calling: true, embeddings: true },
        'openai_compatible' => { text: true, images: false, audio_input: false, audio_output: false, video: false, tool_calling: true, embeddings: false }
      }[slug] || { text: true }
    end

    def missing_config_payload
      {
        feature: @feature,
        provider: nil,
        api_key: nil,
        api_base: nil,
        model: nil,
        source: :missing,
        capabilities: {},
        error: 'CAPTAIN_OPEN_AI_API_KEY / CAPTAIN_OPEN_AI_ENDPOINT / CAPTAIN_OPEN_AI_MODEL must be set'
      }
    end
  end
end
