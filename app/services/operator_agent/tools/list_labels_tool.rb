class OperatorAgent::Tools::ListLabelsTool < OperatorAgent::Tools::BaseTool
  description 'List all conversation labels defined in the account, with how many conversations currently use each one.'
  param :limit, type: 'integer', desc: 'Max results to return (default 100, max 500)', required: false

  def perform(_tool_context, limit: 100)
    limit = limit.to_i.clamp(1, 500)

    labels = account_scoped(Label)
             .left_joins(:conversations)
             .group('labels.id')
             .select('labels.*, COUNT(conversations.id) AS conversations_count')
             .order('conversations_count DESC, labels.title ASC')
             .limit(limit)

    if labels.empty?
      return ok('No labels defined in this account yet.')
    end

    lines = labels.map do |label|
      count = label.respond_to?(:conversations_count) ? label.conversations_count.to_i : 0
      color = label.color.presence ? " (#{label.color})" : ''
      "##{label.id} | #{label.title}#{color} | #{count} conversation(s)"
    end

    ok("#{labels.size} label(s) found:\n#{lines.join("\n")}")
  rescue StandardError => e
    err("Failed to list labels: #{e.message}")
  end
end
