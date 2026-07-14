class OperatorAgent::Tools::CreateInboxTool < OperatorAgent::Tools::BaseTool
  description 'Create a new inbox with any supported channel. For WhatsApp OpenWA use setup_whatsapp_openwa instead (it handles OpenWA sessions). For WhatsApp Cloud, Email, WebWidget, etc. this is the right tool.'
  def self.destructive?
    true
  end

  param :name, type: 'string', desc: 'Inbox name (e.g. "Soporte Web")', required: true
  param :channel_type, type: 'string', desc: 'Channel class: "Channel::WebWidget", "Channel::Api", "Channel::Email", or "Channel::Whatsapp" (for cloud only — use setup_whatsapp_openwa for OpenWA)', required: true
  param :config, type: 'object', desc: 'Channel-specific config (e.g. {"website_url": "https://example.com"} for WebWidget, or {"phone_number": "+525512345678", "provider": "whatsapp_cloud", "provider_config": {"api_key": "..."}} for WhatsApp Cloud)', required: false

  def perform(tool_context, name:, channel_type:, config: {})
    if name.blank? || channel_type.blank?
      return err('name and channel_type are required.')
    end

    klass = channel_type.to_s.safe_constantize
    return err("Unknown channel_type: #{channel_type}. Use Channel::WebWidget, Channel::Api, Channel::Email, or Channel::Whatsapp.") unless klass
    return err('channel_type must be a Channel:: subclass.') unless klass.name.start_with?('Channel::')

    if !confirmed?(tool_context)
      return pending(
        'create_inbox',
        { name: name, channel_type: channel_type, config: config },
        "Crear inbox '#{name}' con canal #{channel_type} (config: #{config.to_json.truncate(120)})"
      )
    end

    channel = klass.create!(
      account: @account,
      **config.symbolize_keys.slice(*klass.column_names.map(&:to_sym))
    )
    inbox = Inbox.create!(account: @account, name: name, channel: channel)
    InboxMember.create!(inbox: inbox, user_id: @user.id)

    log_tool_usage('create_inbox', inbox_id: inbox.id, channel_id: channel.id)
    "✅ Inbox ##{inbox.id} '#{inbox.name}' creado con canal #{channel_type} (channel ##{channel.id})."
  rescue StandardError => e
    err("Failed to create inbox: #{e.message}")
  end
end
