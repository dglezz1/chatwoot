class OperatorAgent::Tools::ListInboxesTool < OperatorAgent::Tools::BaseTool
  description 'List all inboxes in the account. Optionally filter by channel type (e.g. "Channel::Whatsapp", "Channel::WebWidget", "Channel::Email").'
  param :channel_type, type: 'string', desc: 'Optional filter by channel type class name (e.g. "Channel::Whatsapp")', required: false
  param :limit, type: 'integer', desc: 'Max results to return (default 50, max 200)', required: false

  def perform(_tool_context, channel_type: nil, limit: 50)
    limit = limit.to_i.clamp(1, 200)

    scope = account_scoped(Inbox).includes(:channel, :account)
    scope = scope.joins(:channel).where(channels: { type: channel_type }) if channel_type.present?

    inboxes = scope.order(created_at: :desc).limit(limit)

    if inboxes.empty?
      return ok("No inboxes found#{channel_type ? " of type #{channel_type}" : ''}.")
    end

    lines = inboxes.map do |inbox|
      channel_label = inbox.channel&.class&.name&.delete_prefix('Channel::') || 'Unknown'
      agent_count = inbox.inbox_members.count
      "#{inbox.id} | #{inbox.name} | #{channel_label} | #{agent_count} agents | created #{inbox.created_at.to_date}"
    end

    ok("#{inboxes.size} inbox(es) found:\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list inboxes: #{e.message}")
  end
end
