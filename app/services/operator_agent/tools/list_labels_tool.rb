class OperatorAgent::Tools::ListLabelsTool < OperatorAgent::Tools::BaseTool
  description 'List all conversation labels defined in the account, with how many conversations currently use each one.'
  param :limit, type: 'integer', desc: 'Max results to return (default 100, max 500)', required: false

  def perform(_tool_context, limit: 100)
    limit = limit.to_i.clamp(1, 500)

    labels = account_scoped(Label).order(:title).limit(limit).to_a

    if labels.empty?
      return ok('No hay labels definidos en esta cuenta aún.')
    end

    # Count taggings per label (in a separate query to avoid join issues)
    label_ids = labels.map(&:id)
    counts = ActsAsTaggableOn::Tagging
             .where(tag_id: label_ids, taggable_type: 'Conversation')
             .group(:tag_id)
             .count

    lines = labels.map do |label|
      count = counts[label.id] || 0
      color = label.color.presence ? " (#{label.color})" : ''
      "##{label.id} | #{label.title}#{color} | #{count} conversación(es)"
    end

    ok("#{labels.size} label(s):\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list labels: #{e.message}")
  end
end
