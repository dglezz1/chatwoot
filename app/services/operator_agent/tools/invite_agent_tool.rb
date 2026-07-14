class OperatorAgent::Tools::InviteAgentTool < OperatorAgent::Tools::BaseTool
  description 'Invite a new agent (human teammate) to the account. Non-destructive (creates a pending invitation).'

  param :email, type: 'string', desc: 'Email address of the new agent', required: true
  param :name, type: 'string', desc: 'Full name of the new agent', required: true
  param :role, type: 'string', desc: 'Role: "administrator" or "agent" (default "agent")', required: false

  def perform(_tool_context, email:, name:, role: 'agent')
    if email.blank? || name.blank?
      return err('Both email and name are required.')
    end

    role = role.to_s
    return err('Role must be "administrator" or "agent".') unless %w[administrator agent].include?(role)

    existing = User.find_by(email: email)
    if existing && existing.account_users.where(account_id: @account.id).exists?
      return err("User with email #{email} ya es miembro de esta cuenta.")
    end

    user = existing || User.create!(email: email, name: name, password: Devise.friendly_token[0, 20])
    AccountUser.create!(account: @account, user: user, role: role.to_sym)

    log_tool_usage('invite_agent', user_id: user.id, role: role)
    "✅ Agente invitado: @#{user.name} (#{email}) con rol '#{role}'."
  rescue StandardError => e
    err("Failed to invite agent: #{e.message}")
  end
end
