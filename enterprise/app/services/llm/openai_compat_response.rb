# frozen_string_literal: true

# Response wrapper for OpenaiCompatChat — exposes `.content` like
# RubyLLM::ChatCompletion, so existing Captain services that read
# `response.content` work unchanged.
module Llm
  class OpenaiCompatResponse
    attr_reader :raw

    def initialize(raw_response)
      @raw = raw_response
    end

    def content
      parsed = @raw.is_a?(Hash) ? @raw : raw_response_hash
      return nil unless parsed.is_a?(Hash)

      parsed.dig('choices', 0, 'message', 'content') ||
        parsed['content'] ||
        parsed.dig('message', 'content')
    end

    def usage
      parsed = @raw.is_a?(Hash) ? @raw : raw_response_hash
      return {} unless parsed.is_a?(Hash)

      parsed['usage'] || {}
    end

    private

    def raw_response_hash
      @raw.respond_to?(:parsed_response) ? @raw.parsed_response : nil
    end
  end
end
