module Llm::Models
  CONFIG = YAML.load_file(Rails.root.join('config/llm.yml')).freeze

  class << self
    def providers = CONFIG.fetch('providers')
    def models = CONFIG.fetch('models')
    def features = CONFIG.fetch('features')
    def feature_keys = features.keys

    def feature?(feature)
      features.key?(feature.to_s)
    end

    def default_model_for(feature)
      features.dig(feature.to_s, 'default')
    end

    def models_for(feature)
      features.dig(feature.to_s, 'models') || []
    end

    def valid_model_for?(feature, model_name)
      name = model_name.to_s
      return true if models_for(feature).include?(name)
      # Accept any non-empty model id matching the safe pattern — the openai SDK
      # will pass it through to whatever endpoint is configured (OpenAI, OpenRouter,
      # Together, Groq, vLLM, llama.cpp, etc.). This lets admins add models
      # without shipping registry updates.
      name.match?(/\A[A-Za-z0-9._\-\/:]{1,128}\z/) && Llm::Config.openai_configured?
    end

    # Custom models are any model name set in CAPTAIN_OPEN_AI_MODEL that isn't in the
    # registry. Useful for OpenAI-compatible gateways (OpenRouter, Together, vLLM, llama.cpp)
    # where the admin types any model id and the openai SDK passes it through.
    def custom_model?(model_name)
      return false if model_name.blank?
      !models.key?(model_name.to_s) && Llm::Config.openai_configured?
    end

    def model_config(model_name)
      models[model_name.to_s]
    end

    def provider_for(model_name)
      config = model_config(model_name)
      return config['provider'] if config

      # Custom model: detect provider from model name prefix (only used for UI icon).
      # Actual routing goes through the openai SDK regardless.
      detect_provider_from_name(model_name)
    end

    def detect_provider_from_name(model_name)
      name = model_name.to_s.downcase
      return 'openai'      if name.start_with?('gpt-', 'o1', 'o3', 'o4', 'text-embedding-', 'whisper-', 'tts-')
      return 'anthropic'  if name.start_with?('claude-')
      return 'gemini'     if name.start_with?('gemini-')
      return 'mistral'    if name.start_with?('mistral-', 'codestral-')
      return 'deepseek'   if name.start_with?('deepseek-')

      'openai_compatible'
    end

    def feature_config(feature_key)
      feature = features[feature_key.to_s]
      return nil unless feature

      registry_models = models_for(feature_key).map do |model_name|
        model = model_config(model_name)
        {
          id: model_name,
          display_name: model['display_name'],
          provider: model['provider'],
          coming_soon: model['coming_soon'],
          credit_multiplier: model['credit_multiplier']
        }
      end

      {
        models: registry_models,
        default: feature['default']
      }
    end
  end
end
