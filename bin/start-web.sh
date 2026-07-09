#!/bin/bash
set -e

# Migrate + seed if first boot
bundle exec rails db:chatwoot_prepare

# Enable signup so the first admin can register
bundle exec rails runner 'InstallationConfig.find_or_create_by(name: "ENABLE_ACCOUNT_SIGNUP").update(value: "true"); puts "signup ENABLED"' || true

# Start Rails on Railway's $PORT (default 3000)
PORT=${PORT:-3000}
exec bundle exec rails server -p "$PORT" -e production -b 0.0.0.0
