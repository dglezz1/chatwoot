class OperatorAgent::Tools::RemoveAgentTool < OperatorAgent::Tools::BaseTool
  description 'Remove an agent from the account. DESTRUCTIVE — requires operator confirmation.'
  def self.destructive?
    true
  end

  param :agent_id, type: 'integer', desc: 'The user ID of the agent to remove', required: true

  def perform(tool_context, agent_id:)
    account_user = @account.account_users.find_by(user_id: agent_id)
    return err("Agent #{agent_id} is not a member of this account.") unless account_user

    if account_user.user_id == @user.id
      return err('No puedes removerte a ti mismo de la cuenta.')
    end

    if !confirmed?(tool_context)
      return pending(
        'remove_agent',
        { agent_id: agent_id },
        "Remover a @#{account_user.user.name} (#{account_user.user.email}) de la cuenta. Sus conversaciones asignadas se desasignarán."
      )
    end

    log_tool_usage('remove_agent', user_id: agent_id)
    account_user.destroy!

    "✅ @#{account_user.user.name} removido de la cuenta."
  rescue StandardError => e
    err("Failed to remove agent: #{e.message}")
  end
end
