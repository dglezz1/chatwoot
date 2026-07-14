class OperatorAgent::Tools::SearchAcrossTool < OperatorAgent::Tools::BaseTool
  description 'Full-text search across contacts, conversations, articles, and canned responses in this account.'

  param :query, type: 'string', desc: 'Search query (matches name, email, content, etc.)', required: true
  param :entity, type: 'string', desc: 'Limit to one entity type: "contacts" | "conversations" | "articles" | "canned_responses" | "all" (default "all")', required: false
  param :limit, type: 'integer', desc: 'Max results per entity (default 10)', required: false

  def perform(_tool_context, query:, entity: 'all', limit: 10)
    limit = limit.to_i.clamp(1, 50)
    results = {}

    if %w[all contacts].include?(entity)
      like = "%#{query}%"
      contacts = account_scoped(Contact).where('contacts.name ILIKE ? OR contacts.email ILIKE ? OR contacts.phone_number ILIKE ?', like, like, like).limit(limit)
      results[:contacts] = contacts.map { |c| "##{c.id} | #{c.name} | #{c.email || c.phone_number || '(no contact info)'}" }
    end

    if %w[all conversations].include?(entity)
      convs = account_scoped(Conversation).where('messages.content ILIKE ?', "%#{query}%").joins(:messages).distinct.limit(limit)
      results[:conversations] = convs.map { |c| "##{c.id} | display:##{c.display_id} | #{c.status} | last_activity: #{c.last_activity_at&.to_date}" }
    end

    if %w[all articles].include?(entity)
      articles = account_scoped(Article).where('title ILIKE ? OR content ILIKE ?', "%#{query}%", "%#{query}%").limit(limit)
      results[:articles] = articles.map { |a| "##{a.id} | #{a.title} | status: #{a.status}" }
    end

    if %w[all canned_responses].include?(entity)
      crs = account_scoped(CannedResponse).where('short_code ILIKE ? OR content ILIKE ?', "%#{query}%", "%#{query}%").limit(limit)
      results[:canned_responses] = crs.map { |c| "##{c.id} | short_code: '#{c.short_code}' | #{c.content.to_s.truncate(60)}" }
    end

    total = results.values.flatten.size
    if total.zero?
      return ok("Sin resultados para '#{query}' en #{entity}.")
    end

    lines = ["Resultados para '#{query}' (#{total}):"]
    results.each do |kind, items|
      next if items.empty?
      lines << ""
      lines << "**#{kind}** (#{items.size}):"
      items.each { |i| lines << "  - #{i}" }
    end

    ok(lines.join("\n"))
  rescue StandardError => e
    err("Search failed: #{e.message}")
  end
end
