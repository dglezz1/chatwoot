class OperatorAgent::Tools::GetInboxTool < OperatorAgent::Tools::BaseTool
  description 'Get detailed information about a single inbox by its ID: name, channel type, channel config (phone, email, etc.), agent count, and the Captain assistants linked to it.'
  param :inbox_id, type: 'integer', desc: 'The ID of the inbox to fetch', required: true

  def perform(_tool_context, inbox_id:)
    inbox = account_scoped(Inbox).includes(:channel, :account, :inbox_members, captain_assistants_inboxes: :captain_assistant).find_by(id: inbox_id)
    return err("Inbox ##{inbox_id} not found in this account.") unless inbox

    channel = inbox.channel
    channel_class = channel&.class&.name&.delete_prefix('Channel::') || 'Unknown'
    channel_attrs = channel ? channel.attributes.except('id', 'account_id', 'created_at', 'updated_at').map { |k, v| "  #{k}: #{v}" }.join("\n") : '  (no channel)'

    members = inbox.inbox_members.includes(:user, :team).map do |m|
      label = m.user ? "@#{m.user.name} (user ##{m.user.id})" : "team ##{m.team_id}"
      "  - #{label}"
    end
    members_block = members.any? ? members.join("\n") : '  (none)'

    captains = inbox.captain_assistants_inboxes.includes(:captain_assistant).map do |ca|
      "  - Assistant ##{ca.captain_assistant_id} (#{ca.captain_assistant.name}, mode=#{ca.auto_reply_mode})"
    end
    captains_block = captains.any? ? captains.join("\n") : '  (none)'

    <<~TEXT
      Inbox ##{inbox.id}: #{inbox.name}
      Channel: #{channel_class}
      Channel config:
      #{channel_attrs}
      Members (#{inbox.inbox_members.size}):
      #{members_block}
      Captain assistants linked:
      #{captains_block}
      Created: #{inbox.created_at}
    TEXT
  rescue StandardError => e
    err("Failed to get inbox: #{e.message}")
  end
end
