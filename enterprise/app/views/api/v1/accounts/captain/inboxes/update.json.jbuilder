# Renders the per-inbox config (auto_reply, delays, etc.) after a successful update.
# Inlined (not via partial! show) — Rails' underscore convention would otherwise force
# a _show.json.jbuilder file that conflicts with the public show.json.jbuilder render path.
json.partial! 'api/v1/models/inbox', formats: [:json], resource: @captain_inbox.inbox

json.config do
  json.partial! 'shared/config', config: @captain_inbox.config

  json.effective_config do
    json.partial! 'shared/config', config: @captain_inbox.effective_config
  end
end

json.assistant do
  json.id @captain_inbox.captain_assistant.id
  json.name @captain_inbox.captain_assistant.name
  assistant_config = @captain_inbox.captain_assistant.config || {}
  json.welcome_message assistant_config['welcome_message']
  json.handoff_message assistant_config['handoff_message']
  json.resolution_message assistant_config['resolution_message']
end
