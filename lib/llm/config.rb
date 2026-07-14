require 'ruby_llm'

module Llm::Config
  DEFAULT_MODEL = 'gpt-4.1-mini'.freeze

  class << self
    def initialized?
      @initialized ||= false
    end

    def initialize!
      return if @initialized

      configure_ruby_llm
      register_custom_model_with_ruby_llm
      @initialized = true
    end

    def reset!
      @initialized = false
    end

    def with_api_key(api_key, api_base: nil)
      initialize!
      context = RubyLLM.context do |config|
        config.openai_api_key = api_key
        config.openai_api_base = api_base
      end

      yield context
    end

    # Returns true if the installation has a working OpenAI-compatible API
    # configuration (key + endpoint). Used to gate custom-model acceptance in
    # Llm::Models#valid_model_for?.
    def openai_configured?
      system_api_key.present?
    end

    # The provider slug to pass to RubyLLM when a custom model is in use.
    # The OpenAI provider already routes through whatever base URL is set via
    # openai_api_base (which we set to OpenRouter / Together / vLLM / etc.).
    def custom_provider
      'openai'
    end

    private

    def configure_ruby_llm
      RubyLLM.configure do |config|
        config.openai_api_key = system_api_key if system_api_key.present?
        config.openai_api_base = openai_endpoint.chomp('/') if openai_endpoint.present?
        config.model_registry_file = Rails.root.join('config/llm_models.json').to_s
        config.logger = Rails.logger
      end
    end

    # Register the configured custom model in the RubyLLM registry on boot.
    #
    # Why: Captain V2 routes through `Agents::Runner` (ai-agents gem) which
    # calls `RubyLLM::Chat.new(model:)` with strict registry validation. Without
    # this registration, custom models like `anthropic/claude-3.5-sonnet`
    # (used via OpenRouter) raise `RubyLLM::ModelNotFoundError` before any HTTP
    # call. Adding it to the in-memory registry skips validation while still
    # routing through the openai provider (which uses our `openai_api_base`).
    def register_custom_model_with_ruby_llm
      custom_model = system_model
      return if custom_model.blank?
      return if RubyLLM::Models.instance.all.any? { |m| m.id == custom_model }

      RubyLLM::Models.instance.all << RubyLLM::Model::Info.default(custom_model, custom_provider)
    rescue StandardError => e
      Rails.logger.warn "[Llm::Config] failed to register custom model: #{e.message}"
    end

    # ENV-first read with InstallationConfig fallback. ENV wins so the same
    # code runs in both Railway (env-only) and self-hosted (DB) modes without
    # coordination. Mirrors the same pattern in ai_agents.rb.
    def system_api_key
      ENV['CAPTAIN_OPEN_AI_API_KEY'].presence ||
        InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_API_KEY')&.value
    end

    def openai_endpoint
      ENV['CAPTAIN_OPEN_AI_ENDPOINT'].presence ||
        InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value
    end

    def system_model
      ENV['CAPTAIN_OPEN_AI_MODEL'].presence ||
        InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_MODEL')&.value
    end
  end
end
