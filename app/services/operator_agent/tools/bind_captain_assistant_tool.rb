class OperatorAgent::Tools::BindCaptainAssistantTool < OperatorAgent::Tools::BaseTool
  description 'Bind a Captain assistant to an inbox. The assistant will auto-reply to incoming messages on that inbox.'
  def self.destructive?
    true
  end

  param :captain_assistant_id, type: 'integer', desc: 'The Captain assistant ID', required: true
  param :inbox_id, type: 'integer', desc: 'The inbox ID to bind the assistant to', required: true
  param :auto_reply_mode, type: 'string', desc: 'Auto-reply mode: "ai" (default) or "off"', required: false

  def perform(tool_context, captain_assistant_id:, inbox_id:, auto_reply_mode: 'ai')
    assistant = Captain::Assistant.where(account_id: @account.id).find_by(id: captain_assistant_id)
    return err("Captain assistant ##{captain_assistant_id} not found in this account.") unless assistant

    inbox = account_scoped(Inbox).find_by(id: inbox_id)
    return err("Inbox ##{inbox_id} not found.") unless inbox

    binding = CaptainInbox.find_by(captain_assistant: assistant, inbox: inbox)
    if binding
      if !confirmed?(tool_context)
        return pending(
          'bind_captain_assistant',
          { captain_assistant_id: captain_assistant_id, inbox_id: inbox_id, auto_reply_mode: auto_reply_mode },
          "Ya existe la vinculación. Actualizar el auto_reply_mode de '#{auto_reply_mode}' para el assistant ##{assistant.id} en inbox ##{inbox.id}"
        )
      end
      binding.update!(config: binding.config.merge('auto_reply_mode' => auto_reply_mode))
      log_tool_usage('bind_captain_assistant_update', id: binding.id)
      return ok("✅ Vinculación actualizada: Captain ##{assistant.id} en inbox ##{inbox.id} con auto_reply_mode=#{auto_reply_mode}.")
    end

    if !confirmed?(tool_context)
      return pending(
        'bind_captain_assistant',
        { captain_assistant_id: captain_assistant_id, inbox_id: inbox_id, auto_reply_mode: auto_reply_mode },
        "Vincular Captain assistant ##{assistant.id} '#{assistant.name}' al inbox ##{inbox.id} '#{inbox.name}' con auto_reply_mode=#{auto_reply_mode}. Esto activará respuestas automáticas."
      )
    end

    binding = CaptainInbox.create!(
      captain_assistant: assistant,
      inbox: inbox,
      account_id: @account.id,
      config: { 'auto_reply_mode' => auto_reply_mode }
    )

    log_tool_usage('bind_captain_assistant', id: binding.id)
    "✅ Captain assistant ##{assistant.id} '#{assistant.name}' vinculado al inbox ##{inbox.id} '#{inbox.name}' con auto_reply_mode=#{auto_reply_mode}."
  rescue StandardError => e
    err("Failed to bind captain assistant: #{e.message}")
  end
end
