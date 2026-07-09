# Renders a config hash (per-inbox overrides or effective_config).
# Used by the inbox show/update jbuilder.
json.auto_reply_mode config['auto_reply_mode']
json.min_response_delay_seconds config['min_response_delay_seconds']
json.max_response_delay_seconds config['max_response_delay_seconds']
json.debounce_window_seconds config['debounce_window_seconds']
json.welcome_message config['welcome_message']
json.away_message config['away_message']
json.handoff_keywords(config['handoff_keywords'] || [])
json.require_human_acknowledgment config['require_human_acknowledgment']
json.daily_reply_cap config['daily_reply_cap']
json.block_list(config['block_list'] || [])
json.business_hours do
  bh = config['business_hours']
  if bh.is_a?(Hash) && bh.present?
    json.start_hour bh['start_hour']
    json.end_hour bh['end_hour']
    json.timezone bh['timezone']
    json.days(bh['days'] || [])
  else
    json.null
  end
end
