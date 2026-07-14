class OperatorAgent::Tools::CreateCaptainAssistantTool < OperatorAgent::Tools::BaseTool
  description 'Create a new Captain assistant with a name, description, and basic config. Optionally bind it to an inbox in the same call.'
  def self.destructive?
    true
  end

  param :name, type: 'string', desc: 'Assistant name (e.g. "Ventas Bot", "Soporte 24/7")', required: true
  param :description, type: 'string', desc: 'What the assistant does', required: true
  param :product_name, type: 'string', desc: 'The product/service the assistant represents (e.g. "Chambeabot CRM")', required: true
  param :inbox_id, type: 'integer', desc: 'Optional inbox ID to bind the new assistant to', required: false
  param :auto_reply_mode, type: 'string', desc: 'If binding to an inbox, the auto_reply_mode (default "ai")', required: false

  def perform(tool_context, name:, description:, product_name:, inbox_id: nil, auto_reply_mode: 'ai')
    if name.blank? || description.blank? || product_name.blank?
      return err('name, description, and product_name are required.')
    end

    if !confirmed?(tool_context)
      return pending(
        'create_captain_assistant',
        { name: name, description: description, product_name: product_name, inbox_id: inbox_id, auto_reply_mode: auto_reply_mode },
        "Crear Captain assistant '#{name}' (product: #{product_name})#{inbox_id ? " + vincular al inbox ##{inbox_id}" : ''}"
      )
    end

    assistant = Captain::Assistant.create!(
      account_id: @account.id,
      name: name,
      description: description,
      config: {
        'product_name' => product_name,
        'feature_faq' => false,
        'feature_memory' => false,
        'feature_contact_attributes' => false
      }
    )

    if inbox_id.present?
      inbox = account_scoped(Inbox).find_by(id: inbox_id)
      if inbox
        CaptainInbox.create!(
          captain_assistant: assistant,
          inbox: inbox,
          account_id: @account.id,
          config: { 'auto_reply_mode' => auto_reply_mode }
        )
      end
    end

    log_tool_usage('create_captain_assistant', id: assistant.id, inbox_id: inbox_id)
    summary = ["✅ Captain assistant creado: ##{assistant.id} '#{assistant.name}'"]
    summary << "  - product_name: #{product_name}"
    summary << "  - Vinculado al inbox ##{inbox_id} (auto_reply_mode=#{auto_reply_mode})" if inbox_id
    summary.join("\n")
  rescue StandardError => e
    err("Failed to create captain assistant: #{e.message}")
  end
end
