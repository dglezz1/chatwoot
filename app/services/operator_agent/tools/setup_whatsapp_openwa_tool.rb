class OperatorAgent::Tools::SetupWhatsappOpenwaTool < OperatorAgent::Tools::BaseTool
  description 'Full multi-step WhatsApp OpenWA setup: creates the channel, the inbox, a new OpenWA session, binds to a Captain assistant, and returns the QR URL for the operator to scan. DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :inbox_name, type: 'string', desc: 'Name for the new inbox (e.g. "Ventas MX", "Soporte 24/7")', required: true
  param :phone_number, type: 'string', desc: 'The WhatsApp phone number that will be linked (e.g. +525512345678). This is the number that the QR code will register.', required: true
  param :session_id, type: 'string', desc: 'OpenWA session ID. If omitted, a new one is generated from the inbox name.', required: false
  param :openwa_api_base_url, type: 'string', desc: 'OpenWA API URL. Defaults to ENV[OPENWA_API_BASE_URL] (e.g. http://crm-openwa.railway.internal:2785).', required: false
  param :openwa_api_key, type: 'string', desc: 'OpenWA API key. Defaults to ENV[OPENWA_API_KEY].', required: false
  param :captain_assistant_id, type: 'integer', desc: 'Optional Captain assistant ID to bind to this inbox. If provided, the inbox will be linked with auto_reply_mode=ai.', required: false
  param :agent_id, type: 'integer', desc: 'Operator (user) ID to add as the first inbox member. Defaults to the current operator.', required: false

  def perform(tool_context, inbox_name:, phone_number:, session_id: nil, openwa_api_base_url: nil, openwa_api_key: nil, captain_assistant_id: nil, agent_id: nil)
    if inbox_name.blank? || phone_number.blank?
      return err('inbox_name and phone_number are required.')
    end

    if Channel::Whatsapp.where(phone_number: phone_number).exists?
      return err("Ya existe un canal de WhatsApp con el número #{phone_number}.")
    end

    if !confirmed?(tool_context)
      steps = ["crear canal Channel::Whatsapp con provider=openwa para #{phone_number}"]
      steps << "crear Inbox '#{inbox_name}'"
      steps << "iniciar sesión OpenWA y devolver QR"
      steps << "agregar agente ##{agent_id || @user.id} como inbox_member"
      steps << "vincular con Captain assistant ##{captain_assistant_id}" if captain_assistant_id
      return pending(
        'setup_whatsapp_openwa',
        { inbox_name: inbox_name, phone_number: phone_number, session_id: session_id, captain_assistant_id: captain_assistant_id, agent_id: agent_id },
        "Setup WhatsApp OpenWA: #{steps.join(' + ')}"
      )
    end

    base_url = openwa_api_base_url.presence || ENV['OPENWA_API_BASE_URL']
    api_key = openwa_api_key.presence || ENV['OPENWA_API_KEY']

    session_id ||= "ow-#{inbox_name.parameterize}-#{SecureRandom.hex(4)}"

    ActiveRecord::Base.transaction do
      channel = Channel::Whatsapp.create!(
        account: @account,
        phone_number: phone_number,
        provider: 'openwa',
        provider_config: {
          api_base_url: base_url,
          api_key: api_key,
          session_id: session_id
        }
      )

      inbox = Inbox.create!(
        account: @account,
        name: inbox_name,
        channel: channel
      )

      target_agent_id = agent_id || @user.id
      InboxMember.create!(inbox: inbox, user_id: target_agent_id) if target_agent_id.present?

      if captain_assistant_id.present?
        assistant = Captain::Assistant.find_by(id: captain_assistant_id, account_id: @account.id)
        if assistant
          CaptainInbox.create!(
            captain_assistant: assistant,
            inbox: inbox,
            account_id: @account.id,
            config: { 'auto_reply_mode' => 'ai' }
          )
        end
      end

      log_tool_usage('setup_whatsapp_openwa', channel_id: channel.id, inbox_id: inbox.id, session_id: session_id)

      qr_url = begin
        client = Whatsapp::Openwa::Client.new(
          api_base_url: base_url,
          api_key: api_key,
          session_id: session_id
        )
        client.start!
        qr = client.qr
        qr.is_a?(Hash) ? qr['qrCode'] || qr[:qrCode] : qr
      rescue StandardError => e
        Rails.logger.warn "[setup_whatsapp_openwa] QR fetch failed: #{e.message}"
        nil
      end

      summary = ["✅ WhatsApp OpenWA configurado:"]
      summary << "  - Channel: ##{channel.id} (provider=openwa)"
      summary << "  - Inbox: ##{inbox.id} '#{inbox.name}'"
      summary << "  - Phone: #{phone_number}"
      summary << "  - Session: #{session_id}"
      summary << "  - Miembro: ##{target_agent_id}" if target_agent_id
      summary << "  - Captain: assistant ##{captain_assistant_id} (auto_reply_mode=ai)" if captain_assistant_id
      summary << ""
      if qr_url
        summary << "📱 **QR para escanear con el teléfono WhatsApp:**"
        summary << qr_url
        summary << ""
        summary << "Abre WhatsApp en el teléfono #{phone_number} → ⋮ → Dispositivos vinculados → Escanear código."
      else
        summary << "⚠️ No se pudo obtener el QR automáticamente. Usa el dashboard > Captain > OpenWA Live Ops para ver el QR."
      end

      ok(summary.join("\n"))
    end
  rescue StandardError => e
    err("setup_whatsapp_openwa failed: #{e.message}")
  end
end
