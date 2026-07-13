require 'net/http'
require 'uri'
require 'json'

module Llm
  # Validates LLM provider credentials by calling the provider's /models
  # endpoint (OpenAI-compatible). Returns:
  #   { ok: true, model_count: N } — credentials work
  #   { ok: false, error: "..." } — bad key, bad URL, or network issue
  #
  # Synchronous. The async variant is Llm::ProviderValidationJob.
  class ProviderValidator
    def initialize(provider)
      @provider = provider
    end

    def validate
      uri = URI.join("#{@provider.api_base.chomp('/')}/", 'models')
      response = get_json(uri, @provider.api_key)

      return { ok: false, error: "HTTP #{response.code}: #{response.body[0, 200]}" } if response.code.to_i >= 400

      parsed = JSON.parse(response.body)
      model_count = parsed['data']&.size || parsed.dig('models')&.size || 0
      { ok: true, model_count: model_count, sample_models: parsed['data']&.first(3)&.map { |m| m['id'] } }
    rescue StandardError => e
      { ok: false, error: "#{e.class.name}: #{e.message}" }
    end

    private

    def get_json(uri, api_key)
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https', open_timeout: 5, read_timeout: 15) do |http|
        req = Net::HTTP::Get.new(uri.request_uri)
        req['Authorization'] = "Bearer #{api_key}"
        if uri.host.include?('minimaxi.com') || uri.host.include?('minimax.com')
          group_id = ENV['MINIMAX_GROUP_ID'].presence || InstallationConfig.find_by(name: 'MINIMAX_GROUP_ID')&.value
          req['GROUPId'] = group_id if group_id.present?
        end
        http.request(req)
      end
    end
  end
end
