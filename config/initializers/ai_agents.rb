# frozen_string_literal: true

require 'agents'

Rails.application.config.after_initialize do
  api_key = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_API_KEY')&.value
  model = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_MODEL')&.value.presence || LlmConstants::DEFAULT_MODEL
  api_endpoint = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value || LlmConstants::OPENAI_API_ENDPOINT

  if api_key.present?
    Agents.configure do |config|
      config.openai_api_key = api_key
      if api_endpoint.present?
        # Strip trailing slashes. Append `/v1` ONLY if the endpoint doesn't
        # already include one of the common OpenAI-compatible prefixes
        # (`/v1`, `/api/v1`, `/openapi/v1`). Prevents the 404 from double-appending
        # when pointing at OpenRouter (`https://openrouter.ai/api/v1`).
        base = api_endpoint.chomp('/')
        base += '' if base.end_with?('/v1', '/api/v1', '/openapi/v1')
        base += '/v1' unless base.end_with?('/v1', '/api/v1', '/openapi/v1')
        config.openai_api_base = base
      end
      config.default_model = model
      config.debug = false
    end

    # PATCH: ai-agents' Runner calls `RubyLLM::Chat.new(model: <agent.model>)`
    # without `assume_model_exists: true`. When the model id is custom
    # (e.g. `MiniMax-Text-01` via MiniMax, or `anthropic/claude-3.5-sonnet`
    # via OpenRouter), RubyLLM's registry validation rejects it with
    # `RubyLLM::ModelNotFoundError` BEFORE any HTTP call is made. This
    # monkey-patch makes `RubyLLM::Chat#initialize` automatically pass
    # `provider: 'openai', assume_model_exists: true` for the configured
    # custom model. The existing RubyLLM OpenAI provider (already pointed
    # at the custom base URL via Agents.configure above) forwards the
    # model id verbatim to the gateway.
    begin
      require 'ruby_llm'
      chat_class = ::RubyLLM::Chat
      original_init = chat_class.instance_method(:initialize)
      chat_class.class_eval do
        define_method(:initialize) do |model: nil, provider: nil, context: nil, **kwargs|
          installed_model = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_MODEL')&.value
          installed_endpoint = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value

          if installed_endpoint.present? && model.to_s == installed_model.to_s
            provider ||= 'openai'
            kwargs[:assume_model_exists] = true
            kwargs[:provider] = 'openai'
          end

          original_init.bind(self).call(
            model: model,
            provider: provider,
            context: context,
            **kwargs
          )
        end
      end

      # PATCH 2: ai-agents' Runner calls `chat.with_schema(agent.response_schema)`
      # which adds `response_format: { type: 'json_schema', ... }` to the
      # request body. Many OpenAI-compatible gateways (MiniMax, Together,
      # some vLLM deployments, llama.cpp) don't support the strict
      # `json_schema` format and only accept `json_object` or plain text.
      # When the request is sent to a custom endpoint, we force the schema
      # to use `json_object` instead by patching the chat's `with_schema`
      # to mark itself for json_object compatibility.
      original_with_schema = chat_class.instance_method(:with_schema)
      chat_class.class_eval do
        define_method(:with_schema) do |schema, **kwargs|
          installed_endpoint = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value
          # MiniMax's chat completions only support 'json_schema' or 'text' — not
          # the stricter 'response_format' that ai-agents' schema wrapper would
          # generate. We strip the schema entirely for MiniMax and rely on the
          # existing `sanitize_json_response` + model-side JSON-mode prompt to
          # produce parseable JSON.
          #
          # OpenRouter + OpenAI accept full json_schema so we keep it intact.
          if installed_endpoint.to_s.include?('api.minimax.io') && schema
            Rails.logger.debug "[ai_agents] suppressing response_schema for MiniMax endpoint (json_schema not supported)"
            return self
          end
          original_with_schema.bind(self).call(schema, **kwargs)
        end
      end

      # PATCH 3: Silent drop of `response_format: { type: 'json_object' }` for
      # custom endpoints. MiniMax returns HTTP 400 on this type (status code
      # 2013: "unknown response_format type 'json_object'") but accepts
      # `json_schema` and `text`. The downstream JSON parser in each service
      # (sanitize_json_response + JSON.parse) already handles markdown-fenced
      # JSON, so dropping the strict `json_object` hint still produces valid
      # output. See: enterprise/app/services/llm/openai_compat_chat.rb for
      # the parallel change in the V1 fast-path.
      original_with_params = chat_class.instance_method(:with_params)
      chat_class.class_eval do
        define_method(:with_params) do |**params|
          installed_endpoint = InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value
          rf = params[:response_format]
          if installed_endpoint.present? && rf.is_a?(Hash) && rf[:type] == 'json_object'
            Rails.logger.debug "[ai_agents] dropping response_format=json_object for custom endpoint"
            params = params.dup
            params.delete(:response_format)
          end
          original_with_params.bind(self).call(**params)
        end
      end

      Rails.logger.info "[ai_agents] patched RubyLLM::Chat: custom models use provider='openai' + assume_model_exists=true, schemas suppressed, json_object dropped"
    rescue StandardError => e
      Rails.logger.warn "[ai_agents] could not patch RubyLLM::Chat: #{e.message}"
    end
  end
rescue StandardError => e
  Rails.logger.error "Failed to configure AI Agents SDK: #{e.message}"
end