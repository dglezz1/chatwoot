#!/bin/bash
set -e

# Idempotent setup on every boot (works around no-SMTP Railway deploy).
# 1. Run migrations + seed if first boot (chatwoot_prepare is idempotent)
# 2. Enable account signup so first admin can register
# 3. Auto-confirm any unconfirmed users (since SMTP isn't configured)
bundle exec rails db:chatwoot_prepare
bundle exec rails runner '
  InstallationConfig.find_or_create_by(name: "ENABLE_ACCOUNT_SIGNUP").update(value: "true")
  User.where(confirmed_at: nil).find_each do |u|
    u.update!(confirmed_at: Time.current, confirmation_sent_at: Time.current)
    puts "auto-confirmed: #{u.email}"
  end
' || true

# Start Rails server
PORT=${PORT:-3000}
exec bundle exec rails server -p "$PORT" -e production -b 0.0.0.0
