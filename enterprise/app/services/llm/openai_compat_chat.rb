# frozen_string_literal: true

# Drop-in replacement for the chat object returned by RubyLLM.chat(...).
# Used when the configured model isn't in RubyLLM's registry (e.g. any
# OpenAI-compatible gateway model — OpenRouter, Together, vLLM, llama.cpp,
# local LM Studio, etc.). Routes through the openai SDK so the model id is
# passed through unchanged to whichever endpoint CAPTAIN_OPEN_AI_ENDPOINT
# points at.
#
# Implements the same chainable interface used by Captain services:
#
#   chat
#     .with_params(response_format: { type: 'json_object' })
#     .with_instructions("...")
#     .with_schema(schema)
#     .ask(message)
#
# `.ask(message)` returns an OpenaiCompatResponse that exposes `.content`
# (the assistant's text reply) — matching RubyLLM::ChatCompletion#content.
module Llm
  class OpenaiCompatChat
    attr_reader :messages, :params

    def initialize(model:, temperature: 1.0)
      @model = model
      @temperature = temperature
      @messages = []
      @params = {
        temperature: temperature,
        response_format: nil
      }
    end

    # System prompt. RubyLLM uses `:system` role; openai SDK accepts the same.
    def with_instructions(text)
      @messages.reject! { |m| m[:role] == 'system' }
      @messages.unshift({ role: 'system', content: text.to_s }) if text.present?
      self
    end

    # JSON Schema for structured outputs. We pass this through to the openai SDK
    # via `response_format` — JSON Schema strict mode for OpenAI, JSON object
    # mode (or the provider's equivalent) for others.
    def with_schema(schema)
      @params[:response_format] = {
        type: 'json_schema',
        json_schema: { name: 'response', schema: deep_stringify_keys(schema.to_h), strict: false }
      }
      self
    end

    # Generic params passthrough: response_format, max_tokens, top_p, etc.
    # PATCH: Some OpenAI-compatible gateways (MiniMax, Together, certain vLLM
    # deployments, llama.cpp) only support `json_schema` — NOT the simpler
    # `json_object` mode that Chatwoot's services use. To keep the services
    # simple AND the gateway happy, we silently drop `response_format` when its
    # `type` is `json_object` (custom-endpoint mode). The downstream JSON
    # parser in each service already handles markdown-fenced JSON, and the
    # model emits valid JSON when the system prompt asks for it.
    def with_params(extra)
      extra = extra.to_h if extra.respond_to?(:to_h)
      extra.each { |k, v| @params[k.to_sym] = v if @params.key?(k.to_sym) || %i[max_tokens top_p presence_penalty frequency_penalty stop tools tool_choice].include?(k.to_sym) }
      if extra.key?(:response_format)
        rf = extra[:response_format]
        if rf.is_a?(Hash) && rf[:type] == 'json_object' && InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value.present?
          # Silently dropped — see comment above
          @params.delete(:response_format)
        else
          @params[:response_format] = rf
        end
      end
      self
    end

    def with_temperature(value)
      @temperature = value
      @params[:temperature] = value
      self
    end

    # Sends the chat completion request and returns a response with `.content`.
    def ask(message)
      @messages << { role: 'user', content: message.to_s }
      raw = client.chat(
        parameters: {
          model: @model,
          messages: @messages,
          temperature: @params[:temperature] || @temperature,
          max_tokens: @params[:max_tokens],
          top_p: @params[:top_p],
          response_format: @params[:response_format]
        }.compact
      )
      OpenaiCompatResponse.new(raw)
    end

    private

    def client
      @client ||= OpenAI::Client.new(
        access_token: InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_API_KEY')&.value,
        uri_base: InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value.presence || 'https://api.openai.com/',
        log_errors: Rails.env.development?
      )
    end

    def deep_stringify_keys(obj)
      case obj
      when Hash
        obj.each_with_object({}) { |(k, v), h| h[k.to_s] = deep_stringify_keys(v) }
      when Array
        obj.map { |v| deep_stringify_keys(v) }
      else
        obj
      end
    end
  end
end