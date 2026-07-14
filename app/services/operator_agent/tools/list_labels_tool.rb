class OperatorAgent::Tools::ListLabelsTool < OperatorAgent::Tools::BaseTool
  description 'List all conversation labels defined in the account, with how many conversations currently use each one.'
  param :limit, type: 'integer', desc: 'Max results to return (default 100, max 500)', required: false

  def perform(_tool_context, limit: 100)
    limit = limit.to_i.clamp(1, 500)

    labels = account_scoped(Label)
             .left_joins("LEFT JOIN taggings ON taggings.tag_id = labels.id AND taggings.taggable_type = 'Conversation'")
             .group('labels.id')
             .select('labels.*, COUNT(taggings.id) AS conversations_count')
             .order('conversations_count DESC, labels.title ASC')
             .limit(limit)

    if labels.empty?
      return ok('No hay labels definidos en esta cuenta aún.')
    end

    lines = labels.map do |label|
      count = label.respond_to?(:conversations_count) ? label.conversations_count.to_i : 0
      color = label.color.presence ? " (#{label.color})" : ''
      "##{label.id} | #{label.title}#{color} | #{count} conversación(es)"
    end

    ok("#{labels.size} label(s):\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list labels: #{e.message}")
  end
end
