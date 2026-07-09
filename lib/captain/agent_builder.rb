# frozen_string_literal: true

# Captain::AgentBuilder — programmatic creation of a Captain Assistant
# with training data (web pages, PDFs, raw text) and conversational guardrails.
#
# Used by:
#   - bin/setup-captain-agent.sh (one-shot CLI)
#   - POST /api/v1/accounts/:id/captain/agents (programmatic creation)
#
# Example:
#
#   Captain::AgentBuilder.new(account: Account.first).build(
#     name: 'Customer Support',
#     description: 'Answers questions about our product',
#     instructions: 'You are a helpful support agent...',
#     product_name: 'MyApp',
#     guardrails: [
#       'Never share internal pricing details',
#       'Always defer account-specific questions to a human agent'
#     ],
#     response_guidelines: [
#       'Reply in the customer\'s language',
#       'Be concise (under 200 words)'
#     ],
#     scenarios: [
#       { title: 'Refund request', description: 'Customer wants refund',
#         instruction: 'Ask for order number and reason' },
#       { title: 'Bug report', description: 'Customer reports a bug',
#         instruction: 'Collect repro steps and screenshot' }
#     ],
#     documents: [
#       { type: :url,   source: 'https://docs.example.com' },
#       { type: :url,   source: 'https://example.com/pricing' },
#       { type: :pdf,   source: '/path/to/manual.pdf' },
#       { type: :text,  source: 'Internal runbook content...',
#         name: 'Internal Runbook' }
#     ],
#     temperature: 0.5,
#     feature_faq: true
#   )
module Captain
  class AgentBuilder
    Result = Struct.new(:assistant, :documents, :scenarios, keyword_init: true)

    class BuildError < StandardError; end

    def initialize(account:)
      @account = account
    end

    def build(name:, description:, instructions: nil,
              product_name: nil, guardrails: [], response_guidelines: [],
              scenarios: [], documents: [], temperature: 1.0,
              feature_faq: true, feature_memory: false,
              feature_contact_attributes: false,
              welcome_message: nil, handoff_message: nil,
              resolution_message: nil, async: false)
      validate!(name: name, description: description, instructions: instructions)

      assistant = create_assistant(
        name: name, description: description,
        product_name: product_name,
        guardrails: guardrails,
        response_guidelines: response_guidelines,
        instructions: instructions,
        temperature: temperature,
        feature_faq: feature_faq,
        feature_memory: feature_memory,
        feature_contact_attributes: feature_contact_attributes,
        welcome_message: welcome_message,
        handoff_message: handoff_message,
        resolution_message: resolution_message
      )

      created_documents = documents.flat_map do |doc|
        create_document(assistant, doc, async: async)
      end

      created_scenarios = scenarios.map do |sc|
        create_scenario(assistant, sc)
      end

      Result.new(
        assistant: assistant,
        documents: created_documents.compact,
        scenarios: created_scenarios.compact
      )
    end

    private

    def validate!(name:, description:, instructions:)
      raise BuildError, 'name is required'        if name.blank?
      raise BuildError, 'description is required' if description.blank?
      raise BuildError, 'instructions is required' if instructions.blank?
    end

    def create_assistant(name:, description:, product_name:, guardrails:,
                          response_guidelines:, instructions:, temperature:,
                          feature_faq:, feature_memory:, feature_contact_attributes:,
                          welcome_message:, handoff_message:, resolution_message:)
      Captain::Assistant.create!(
        account: @account,
        name: name,
        description: description,
        config: {
          'product_name' => product_name || 'our product',
          'feature_faq' => feature_faq,
          'feature_memory' => feature_memory,
          'feature_contact_attributes' => feature_contact_attributes,
          'instructions' => instructions,
          'temperature' => temperature,
          'welcome_message' => welcome_message,
          'handoff_message' => handoff_message,
          'resolution_message' => resolution_message
        }.compact,
        response_guidelines: response_guidelines.presence,
        guardrails: guardrails.presence
      )
    end

    def create_scenario(assistant, scenario_attrs)
      title = scenario_attrs[:title] || scenario_attrs['title']
      Captain::Scenario.create!(
        assistant: assistant,
        account: @account,
        title: title,
        description: scenario_attrs[:description] || scenario_attrs['description'],
        instruction: scenario_attrs[:instruction] || scenario_attrs['instruction'],
        tools: Array(scenario_attrs[:tools] || scenario_attrs['tools']),
        enabled: scenario_attrs.fetch(:enabled, true)
      )
    end

    # Document types:
    #   { type: :url,  source: 'https://...' }                  → web scrape
    #   { type: :pdf,  source: '/local/path.pdf' }              → upload PDF
    #   { type: :text, source: '...long content...', name: 'X' } → inline content
    def create_document(assistant, doc_attrs, async:)
      type  = (doc_attrs[:type] || doc_attrs['type'] || :url).to_sym
      src   = doc_attrs[:source] || doc_attrs['source']
      name  = doc_attrs[:name] || doc_attrs['name'] || default_name_for(type, src)
      meta  = doc_attrs[:metadata] || doc_attrs['metadata'] || {}

      raise BuildError, "document.source is required for type=#{type}" if src.blank?

      doc = case type
            when :url  then create_url_document(assistant, src, name, meta)
            when :pdf  then create_pdf_document(assistant, src, name, meta)
            when :text then create_text_document(assistant, src, name, meta)
            else raise BuildError, "unknown document type: #{type}"
            end

      # For text docs we set content directly and mark available immediately;
      # for URL/PDF the CrawlJob (enqueued by after_create_commit) will fetch.
      doc.update!(status: :available) if type == :text
      doc
    rescue ActiveRecord::RecordInvalid => e
      Rails.logger.error "[AgentBuilder] failed to create document #{name}: #{e.message}"
      nil
    end

    def create_url_document(assistant, url, name, metadata)
      Captain::Document.create!(
        assistant: assistant,
        account: @account,
        name: name,
        external_link: url,
        metadata: metadata
      )
    end

    def create_pdf_document(assistant, path, name, metadata)
      raise BuildError, "PDF file not found: #{path}" unless File.exist?(path)

      doc = Captain::Document.new(
        assistant: assistant,
        account: @account,
        name: name,
        metadata: metadata.merge('source' => 'cli_upload')
      )
      doc.pdf_file.attach(
        io: File.open(path),
        filename: File.basename(path),
        content_type: 'application/pdf'
      )
      doc.save!
      doc
    end

    def create_text_document(assistant, content, name, metadata)
      Captain::Document.create!(
        assistant: assistant,
        account: @account,
        name: name,
        external_link: "TEXT:#{name.parameterize}_#{Time.current.to_i}",
        content: content.to_s,
        metadata: metadata.merge('source' => 'inline_text', 'mime_type' => 'text/markdown')
      )
    end

    def default_name_for(type, source)
      case type
      when :url  then URI.parse(source).host.to_s rescue 'Web page'
      when :pdf  then File.basename(source.to_s, '.pdf')
      when :text then 'Custom text'
      else 'Document'
      end
    end
  end
end