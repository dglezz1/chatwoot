class OperatorAgent::Tools::ListTeamsTool < OperatorAgent::Tools::BaseTool
  description 'List all teams in the account with their member counts.'

  def perform(_tool_context)
    teams = @account.teams.includes(:team_members).order(created_at: :desc)
    if teams.empty?
      return ok('No hay teams configurados en esta cuenta.')
    end

    lines = teams.map do |t|
      members = t.team_members.count
      "##{t.id} | #{t.name} | #{members} miembros | allow_auto_assign=#{t.allow_auto_assign}#{t.description.present? ? " | #{t.description.to_s.truncate(50)}" : ''}"
    end

    ok("#{teams.size} team(s):\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list teams: #{e.message}")
  end
end
