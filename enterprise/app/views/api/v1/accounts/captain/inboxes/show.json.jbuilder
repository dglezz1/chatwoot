# Renders the per-inbox config (auto-reply mode, delays, welcome message, etc.)
# alongside the assistant's defaults so the UI can show effective values.
json.partial! 'api/v1/models/inbox', formats: [:json], resource: @captain_inbox.inbox

json.config do
  # Per-inbox overrides (may be empty hash)
  json.partial! 'shared/config', config: @captain_inbox.config

  # Effective config (merged with defaults) — the values actually used at runtime
  json.effective_config do
    json.partial! 'shared/config', config: @captain_inbox.effective_config
  end
end

# Assistant defaults that the UI may want to show alongside overrides
json.assistant do
  json.id @captain_inbox.captain_assistant.id
  json.name @captain_inbox.captain_assistant.name
  assistant_config = @captain_inbox.captain_assistant.config || {}
  json.welcome_message assistant_config['welcome_message']
  json.handoff_message assistant_config['handoff_message']
  json.resolution_message assistant_config['resolution_message']
end
