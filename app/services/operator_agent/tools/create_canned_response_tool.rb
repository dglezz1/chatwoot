class OperatorAgent::Tools::CreateCannedResponseTool < OperatorAgent::Tools::BaseTool
  description 'Create a new canned response (template for quick replies). Non-destructive.'

  param :short_code, type: 'string', desc: 'Short code (e.g. "greeting", "price")', required: true
  param :content, type: 'string', desc: 'The full response text (supports {{contact.name}} placeholders)', required: true

  def perform(_tool_context, short_code:, content:)
    if short_code.blank? || content.blank?
      return err('Both short_code and content are required.')
    end

    existing = account_scoped(CannedResponse).find_by(short_code: short_code)
    return err("Canned response con short_code '#{short_code}' ya existe (##{existing.id}). Usa update_canned_response.") if existing

    cr = account_scoped(CannedResponse).create!(short_code: short_code, content: content)
    log_tool_usage('create_canned_response', id: cr.id)
    "✅ Canned response creada: ##{cr.id} (short_code: '#{cr.short_code}')"
  rescue StandardError => e
    err("Failed to create canned response: #{e.message}")
  end
end
