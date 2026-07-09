# frozen_string_literal: true

# API endpoints for programmatic creation of Captain AI agents with
# training data (web pages, PDFs, raw text) and conversational guardrails.
#
# POST /api/v1/accounts/:account_id/captain/agents
#   body: { agent: { name:, description:, instructions:, guardrails:[],
#                    response_guidelines:[], scenarios:[{...}],
#                    documents:[{type, source, name?}], ... } }
#   → returns { id, name, documents: [...], scenarios: [...] }
#
# GET  /api/v1/accounts/:account_id/captain/agents/schema
#   → returns the expected request shape for documentation
class Api::V1::Accounts::Captain::AgentsController < Api::V1::Accounts::BaseController
  before_action :current_account

  def schema
    render json: {
      agent: {
        name: 'string (required)',
        description: 'string (required)',
        instructions: 'string (required, system prompt)',
        product_name: 'string (optional)',
        temperature: 'number 0.0-2.0 (default 1.0)',
        feature_faq: 'boolean (default true)',
        feature_memory: 'boolean (default false)',
        feature_contact_attributes: 'boolean (default false)',
        welcome_message: 'string',
        handoff_message: 'string (shown when AI hands off to human)',
        resolution_message: 'string (shown on conversation close)',
        guardrails: ['array of strings — hard rules the AI must obey'],
        response_guidelines: ['array of strings — soft style/tone rules'],
        scenarios: [
          {
            title: 'string (required)',
            description: 'string (required, when this fires)',
            instruction: 'string (required, how to handle it)',
            tools: 'array of tool names (optional)',
            enabled: 'boolean (default true)'
          }
        ],
        documents: [
          {
            type: 'url | pdf | text',
            source: 'URL for url / file path for pdf / raw string for text',
            name: 'optional display name',
            metadata: 'optional hash'
          }
        ]
      },
      notes: [
        'URLs are crawled by SimplePageCrawlService (free, basic) — ' \
          'or Firecrawl if CAPTAIN_FIRECRAWL_API_KEY is set.',
        'PDFs are uploaded and processed via OpenAI Files API.',
        'Text content is stored inline up to 200k chars; ' \
          'exceeding this is rejected.',
        'Guardrails are HARD rules — the AI cannot break them. ' \
          'Response guidelines are soft style/tone preferences.',
        'A doc with status=in_progress is normal right after creation; ' \
          'CrawlJob runs in the background and marks it available when done.'
      ]
    }
  end

  def create
    agent_params = params.require(:agent).permit(
      :name, :description, :instructions,
      :product_name, :temperature, :feature_faq, :feature_memory,
      :feature_contact_attributes, :welcome_message, :handoff_message,
      :resolution_message,
      guardrails: [],
      response_guidelines: [],
      scenarios: [:title, :description, :instruction, :enabled, { tools: [] }],
      documents: [:type, :source, :name, metadata: {}]
    )

    result = Captain::AgentBuilder.new(account: Current.account).build(
      name: agent_params[:name],
      description: agent_params[:description],
      instructions: agent_params[:instructions],
      product_name: agent_params[:product_name],
      guardrails: agent_params[:guardrails].to_a,
      response_guidelines: agent_params[:response_guidelines].to_a,
      scenarios: agent_params[:scenarios].to_a.map(&:to_h).map(&:symbolize_keys),
      documents: agent_params[:documents].to_a.map(&:to_h).map(&:symbolize_keys),
      temperature: agent_params[:temperature].present? ? agent_params[:temperature].to_f : 1.0,
      feature_faq: agent_params[:feature_faq] != false,
      feature_memory: agent_params[:feature_memory] == true,
      feature_contact_attributes: agent_params[:feature_contact_attributes] == true,
      welcome_message: agent_params[:welcome_message],
      handoff_message: agent_params[:handoff_message],
      resolution_message: agent_params[:resolution_message]
    )

    render json: serialize(result), status: :created
  rescue Captain::AgentBuilder::BuildError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def show
    result = Captain::AgentBuilder::Result.new(
      assistant: current_assistant,
      documents: current_assistant.documents.order(created_at: :desc).limit(50),
      scenarios: current_assistant.scenarios.order(created_at: :desc)
    )
    render json: serialize(result)
  end

  # Bulk creation: creates N agents in one call. Useful for migrations or
  # spinning up per-product agents in a pipeline.
  #
  # POST /api/v1/accounts/:account_id/captain/agents/bulk_create
  # body: { agents: [ { agent: {...} }, { agent: {...} } ] }
  # → returns { created: [...], failed: [{index, name, error}] }
  def bulk_create
    raw_agents = params.require(:agents)
    results = { created: [], failed: [] }

    raw_agents.each_with_index do |raw_agent, idx|
      agent_params = raw_agent.require(:agent).permit(
        :name, :description, :instructions,
        :product_name, :temperature, :feature_faq, :feature_memory,
        :feature_contact_attributes, :welcome_message, :handoff_message,
        :resolution_message,
        guardrails: [],
        response_guidelines: [],
        scenarios: [:title, :description, :instruction, :enabled, { tools: [] }],
        documents: [:type, :source, :name, metadata: {}]
      )

      result = Captain::AgentBuilder.new(account: Current.account).build(
        name: agent_params[:name],
        description: agent_params[:description],
        instructions: agent_params[:instructions],
        product_name: agent_params[:product_name],
        guardrails: agent_params[:guardrails].to_a,
        response_guidelines: agent_params[:response_guidelines].to_a,
        scenarios: agent_params[:scenarios].to_a.map(&:to_h).map(&:symbolize_keys),
        documents: agent_params[:documents].to_a.map(&:to_h).map(&:symbolize_keys),
        temperature: agent_params[:temperature].present? ? agent_params[:temperature].to_f : 1.0,
        feature_faq: agent_params[:feature_faq] != false,
        feature_memory: agent_params[:feature_memory] == true,
        feature_contact_attributes: agent_params[:feature_contact_attributes] == true,
        welcome_message: agent_params[:welcome_message],
        handoff_message: agent_params[:handoff_message],
        resolution_message: agent_params[:resolution_message]
      )

      results[:created] << { index: idx, name: result.assistant.name,
                             id: result.assistant.id,
                             document_count: result.documents.size,
                             scenario_count: result.scenarios.size }
    rescue Captain::AgentBuilder::BuildError => e
      results[:failed] << { index: idx, name: agent_params[:name], error: e.message }
    rescue ActionController::ParameterMissing => e
      results[:failed] << { index: idx, name: nil, error: e.message }
    end

    status_code = results[:failed].empty? ? :ok : :multi_status
    render json: results, status: status_code
  end

  private

  def current_assistant
    @current_assistant ||= Current.account.captain_assistants.find(params[:id])
  end

  def serialize(result)
    {
      id: result.assistant.id,
      name: result.assistant.name,
      description: result.assistant.description,
      config: result.assistant.config,
      guardrails: result.assistant.guardrails,
      response_guidelines: result.assistant.response_guidelines,
      scenarios: result.scenarios.map do |s|
        { id: s.id, title: s.title, description: s.description,
          instruction: s.instruction, enabled: s.enabled, tools: s.tools }
      end,
      documents: result.documents.map do |d|
        { id: d.id, name: d.name, type: doc_type(d), status: d.status,
          external_link: d.external_link, has_pdf: d.pdf_file.attached?,
          content_length: d.content&.length,
          created_at: d.created_at.to_i }
      end
    }
  end

  def doc_type(doc)
    return 'pdf'   if doc.pdf_file.attached?
    return 'text'  if doc.external_link.to_s.start_with?('TEXT:')

    'url'
  end
end