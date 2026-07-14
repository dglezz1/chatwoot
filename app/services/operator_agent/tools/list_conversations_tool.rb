class OperatorAgent::Tools::ListConversationsTool < OperatorAgent::Tools::BaseTool
  description 'List recent conversations, optionally filtered by status and/or inbox.'

  param :status, type: 'string', desc: 'Filter by status: "open", "resolved", "pending", "snoozed", or "all" (default "open")', required: false
  param :inbox_id, type: 'integer', desc: 'Optional inbox ID to filter by', required: false
  param :limit, type: 'integer', desc: 'Max results (default 25, max 100)', required: false

  def perform(_tool_context, status: 'open', inbox_id: nil, limit: 25)
    limit = limit.to_i.clamp(1, 100)

    scope = account_scoped(Conversation).includes(:contact, :inbox, :assignee)
    scope = scope.where(status: status) if status.present? && status != 'all'
    scope = scope.where(inbox_id: inbox_id) if inbox_id.present?
    convs = scope.order(last_activity_at: :desc).limit(limit)

    if convs.empty?
      return ok("Sin conversaciones#{" con status=#{status}" if status.present? && status != 'all'}#{' en inbox #' + inbox_id.to_s if inbox_id}.")
    end

    lines = convs.map do |c|
      assignee_label = c.assignee ? "@#{c.assignee.name}" : 'sin asignar'
      last_msg = c.messages.order(created_at: :desc).first
      preview = last_msg ? last_msg.content.to_s.truncate(60).gsub("\n", ' ') : '(sin mensajes)'
      inbox_name = c.inbox&.name || "inbox##{c.inbox_id}"
      "##{c.id} (display ##{c.display_id}) | #{inbox_name} | #{c.status} | #{assignee_label} | #{c.last_activity_at&.to_date} | #{preview}"
    end

    ok("#{convs.size} conversación(es):\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list conversations: #{e.message}")
  end
end
