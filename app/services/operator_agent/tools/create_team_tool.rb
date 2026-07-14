class OperatorAgent::Tools::CreateTeamTool < OperatorAgent::Tools::BaseTool
  description 'Create a new team (group of agents that can be assigned conversations together).'

  param :name, type: 'string', desc: 'Team name', required: true
  param :description, type: 'string', desc: 'Optional description', required: false
  param :allow_auto_assign, type: 'boolean', desc: 'Whether conversations can be auto-assigned to this team (default true)', required: false

  def perform(_tool_context, name:, description: nil, allow_auto_assign: true)
    if name.blank?
      return err('Team name is required.')
    end

    existing = @account.teams.find_by(name: name)
    return err("Team '#{name}' ya existe (##{existing.id}).") if existing

    team = @account.teams.create!(name: name, description: description, allow_auto_assign: allow_auto_assign)
    log_tool_usage('create_team', id: team.id)
    "✅ Team '#{team.name}' creado (##{team.id})."
  rescue StandardError => e
    err("Failed to create team: #{e.message}")
  end
end
