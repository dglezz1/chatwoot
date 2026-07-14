class OperatorAgent::Tools::ListAgentsTool < OperatorAgent::Tools::BaseTool
  description 'List the human agents (teammates) in the account, including their role, availability, and which inboxes they belong to.'
  param :availability, type: 'string', desc: 'Optional filter by availability status: "online", "busy", or "offline"', required: false

  def perform(_tool_context, availability: nil)
    scope = @account.account_users
                    .joins(:user)
                    .includes(user: { inboxes: [] })
                    .where(users: { type: nil }) # exclude bots/agents

    # Note: availability_status is dynamic (computed from current presence),
    # so we apply the filter after loading if requested.
    account_users = scope.to_a
    account_users = account_users.select { |au| au.user.availability_status == availability } if availability.present?

    if account_users.empty?
      return ok("No agents found#{availability ? " with availability=#{availability}" : ''}.")
    end

    lines = account_users.map do |au|
      u = au.user
      inbox_names = u.inboxes.map(&:name).join(', ')
      "##{u.id} | #{u.name} (#{u.email}) | role=#{au.role} | availability=#{u.availability_status} | inboxes=[#{inbox_names.presence || 'none'}]"
    end

    ok("#{account_users.size} agent(s) found:\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list agents: #{e.message}")
  end
end
