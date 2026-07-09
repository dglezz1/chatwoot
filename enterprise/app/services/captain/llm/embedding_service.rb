class Captain::Llm::EmbeddingService
  include Integrations::LlmInstrumentation

  class EmbeddingsError < StandardError; end

  EMBEDDING_TYPE_DOC = 'db'      # when storing text for later retrieval (MiniMax shape only)
  EMBEDDING_TYPE_QUERY = 'query' # when embedding the user's question      (MiniMax shape only)

  # Hosts where MiniMax-style `{model, type, texts}` payload applies.
  # Everything else (OpenRouter, OpenAI, vLLM, llama.cpp…) uses standard
  # OpenAI shape `{model, input}`.
  MINIMAX_HOSTS = ['api.minimax.io', 'api.MiniMax.com'].freeze

  def initialize(account_id: nil)
    Llm::Config.initialize!
    @account_id = account_id
    @embedding_model = self.class.embedding_model
  end

  def self.embedding_model
    InstallationConfig.find_by(name: 'CAPTAIN_EMBEDDING_MODEL')&.value.presence || LlmConstants::DEFAULT_EMBEDDING_MODEL
  end

  def get_embedding(content, model: @embedding_model, type: EMBEDDING_TYPE_DOC)
    return [] if content.blank?

    instrument_embedding_call(instrumentation_params(content, model)) do
      embed_via_http(content.to_s, model: model, type: type)
    end
  rescue EmbeddingsError => e
    Rails.logger.error "Embedding API Error: #{e.message}"
    raise
  end

  private

  # Provider-agnostic embedding call. The training/FAQ pipeline never needs
  # to know whether it talks to MiniMax, OpenRouter, OpenAI, Together, or a
  # local vLLM — it just hands text in and gets a vector out.
  #
  # MiniMax shape (host matches):
  #   { model, type: 'db'|'query', texts: [content] }
  #   response: { vectors: [[...], ...] }
  #
  # OpenAI-compatible shape (everywhere else):
  #   { model, input: content }                # string
  #   { model, input: [content] }              # or array — we use string
  #   response: { data: [{ embedding: [...] }] }
  def embed_via_http(content, model:, type:)
    require 'net/http'
    require 'uri'
    require 'json'

    endpoint = embedding_endpoint
    api_key  = embedding_api_key
    raise EmbeddingsError, 'No embedding endpoint configured' if endpoint.blank?
    raise EmbeddingsError, 'No embedding API key configured' if api_key.blank?

    uri = URI.parse("#{endpoint.sub(/\/+$/, '')}/embeddings")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == 'https'
    http.read_timeout = 60
    http.open_timeout = 10

    req = Net::HTTP::Post.new(uri.request_uri,
                              'Authorization' => "Bearer #{api_key}",
                              'Content-Type' => 'application/json')

    if minimax_host?(uri.host)
      req.body = JSON.dump(model: model, type: type, texts: [content])
    else
      req.body = JSON.dump(model: model, input: content)
    end

    res = http.request(req)
    parsed = JSON.parse(res.body)

    if res.code.to_i >= 400
      msg = parsed.dig('base_resp', 'status_msg') || parsed.dig('error', 'message') || res.body.to_s[0, 200]
      raise EmbeddingsError, "HTTP #{res.code} #{msg}"
    end

    vector = if minimax_host?(uri.host)
               parsed.dig('vectors', 0)
             else
               parsed.dig('data', 0, 'embedding')
             end

    if vector.nil? || !vector.is_a?(Array)
      raise EmbeddingsError, "Empty embedding vector in response: #{parsed.to_s[0, 200]}"
    end

    vector
  rescue StandardError => e
    raise EmbeddingsError, "Failed to create an embedding: #{e.message}" if e.is_a?(EmbeddingsError)

    raise EmbeddingsError, "Failed to create an embedding: #{e.message}"
  end

  # Embedding endpoint falls back to chat endpoint when no separate value
  # is configured. Same for the API key. Embedding model has its own field
  # (`CAPTAIN_EMBEDDING_MODEL`) because chat models (e.g. `MiniMax-Text-01`)
  # can't embed and vice-versa.
  def embedding_endpoint
    InstallationConfig.find_by(name: 'CAPTAIN_EMBEDDING_ENDPOINT')&.value.presence ||
      InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_ENDPOINT')&.value.presence ||
      'https://api.openai.com/v1'
  end

  def embedding_api_key
    InstallationConfig.find_by(name: 'CAPTAIN_EMBEDDING_API_KEY')&.value.presence ||
      InstallationConfig.find_by(name: 'CAPTAIN_OPEN_AI_API_KEY')&.value.presence
  end

  def minimax_host?(host)
    MINIMAX_HOSTS.include?(host)
  end

  def instrumentation_params(content, model)
    {
      span_name: 'llm.captain.embedding',
      model: model,
      input: content,
      feature_name: 'embedding',
      account_id: @account_id
    }
  end
end
