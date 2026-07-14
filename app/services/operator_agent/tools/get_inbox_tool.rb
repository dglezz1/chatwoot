class OperatorAgent::Tools::GetInboxTool < OperatorAgent::Tools::BaseTool
  description 'Get detailed information about a single inbox by its ID: name, channel type, channel config (phone, email, etc.), agent count, and the Captain assistants linked to it.'
  param :inbox_id, type: 'integer', desc: 'The ID of the inbox to fetch', required: true

  def perform(_tool_context, inbox_id:)
    inbox = account_scoped(Inbox).includes(:channel, :account, :inbox_members, :captain_inbox).find_by(id: inbox_id)
    return err("Inbox ##{inbox_id} not found in this account.") unless inbox

    channel = inbox.channel
    channel_class = channel&.class&.name&.delete_prefix('Channel::') || 'Unknown'
    channel_attrs = channel ? channel.attributes.except('id', 'account_id', 'created_at', 'updated_at').map { |k, v| "  #{k}: #{v}" }.join("\n") : '  (no channel)'

    members = inbox.inbox_members.includes(:user).map do |m|
      label = m.user ? "@#{m.user.name} (user ##{m.user.id})" : "(user id #{m.user_id})"
      "  - #{label}"
    end
    members_block = members.any? ? members.join("\n") : '  (none)'

    captain_inbox = inbox.captain_inbox
    captain_block = if captain_inbox
      assistant = Captain::Assistant.find_by(id: captain_inbox.captain_assistant_id)
      mode = captain_inbox.config&.dig('auto_reply_mode') || 'unknown'
      "  - Assistant ##{captain_inbox.captain_assistant_id} (#{assistant&.name || 'unknown'}, mode=#{mode})"
    else
      '  (none)'
    end

    <<~TEXT
      Inbox ##{inbox.id}: #{inbox.name}
      Channel: #{channel_class}
      Channel config:
      #{channel_attrs}
      Members (#{inbox.inbox_members.size}):
      #{members_block}
      Captain assistant linked:
      #{captain_block}
      Created: #{inbox.created_at}
    TEXT
  rescue StandardError => e
    err("Failed to get inbox: #{e.message}")
  end
end
