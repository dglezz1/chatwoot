#!/bin/bash
set -e

# Idempotent setup on every boot (works around no-SMTP Railway deploy).
bundle exec rails db:chatwoot_prepare
bundle exec rails runner 'InstallationConfig.find_or_create_by(name: "ENABLE_ACCOUNT_SIGNUP").update(value: "true"); User.where(confirmed_at: nil).find_each { |u| u.update!(confirmed_at: Time.current, confirmation_sent_at: Time.current) }' || true

# Start Rails server
PORT=${PORT:-3000}
exec bundle exec rails server -p "$PORT" -e production -b 0.0.0.0
