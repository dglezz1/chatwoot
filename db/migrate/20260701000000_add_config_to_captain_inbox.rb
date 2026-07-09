class AddConfigToCaptainInbox < ActiveRecord::Migration[7.0]
  # Per-inbox overrides for the SmartBot auto-reply pipeline.
  # All fields are optional; the AutoReplyJob applies sensible defaults when blank.
  #
  # Schema (stored under `config` jsonb):
  #   auto_reply_mode: 'off' | 'welcome_only' | 'ai'              (default 'ai')
  #   min_response_delay_seconds: int                            (default 15)
  #   max_response_delay_seconds: int                            (default 45)
  #   debounce_window_seconds: int                               (default 20)
  #   welcome_message: string  (overrides assistant's default)   (default nil → use assistant's)
  #   away_message: string    (sent when client messages outside business hours)  (default nil)
  #   business_hours: object  ({start_hour, end_hour, timezone, days[]})         (default nil → always-on)
  #   handoff_keywords: string[] (triggers handoff to a human when matched)      (default [])
  def change
    add_column :captain_inboxes, :config, :jsonb, default: {}, null: false
  end
end
