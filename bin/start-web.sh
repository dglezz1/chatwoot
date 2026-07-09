#!/bin/bash
# Idempotent setup on every boot. No `set -e` to keep going on any failure.

# Run migrations + seed if first boot
bundle exec rails db:chatwoot_prepare || echo "WARN: db:chatwoot_prepare failed"

# Enable signup
bundle exec rails runner 'InstallationConfig.find_or_create_by(name: "ENABLE_ACCOUNT_SIGNUP").update(value: "true"); User.where(confirmed_at: nil).find_each { |u| u.update!(confirmed_at: Time.current, confirmation_sent_at: Time.current); puts "auto-confirmed #{u.email}" }' || echo "WARN: rails runner failed"

# Start Rails server (in foreground)
PORT=${PORT:-3000}
exec bundle exec rails server -p "$PORT" -e production -b 0.0.0.0
