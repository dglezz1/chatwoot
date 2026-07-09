#!/bin/bash
echo "[start-web.sh] BEGIN $(date)"

# Run migrations + seed if first boot
echo "[start-web.sh] running db:chatwoot_prepare"
bundle exec rails db:chatwoot_prepare
PREPARE_RC=$?
echo "[start-web.sh] db:chatwoot_prepare done (rc=$PREPARE_RC)"

# Enable signup + auto-confirm any unconfirmed users (for Railway with no SMTP)
echo "[start-web.sh] running signup setup"
RAILS_RUNNER_OUTPUT=$(bundle exec rails runner 'InstallationConfig.find_or_create_by(name: "ENABLE_ACCOUNT_SIGNUP").update(value: "true"); User.where(confirmed_at: nil).find_each { |u| u.update!(confirmed_at: Time.current, confirmation_sent_at: Time.current); puts "auto-confirmed #{u.email}" }' 2>&1)
RUNNER_RC=$?
echo "[start-web.sh] rails runner done (rc=$RUNNER_RC)"
echo "[start-web.sh] rails runner output: $RAILS_RUNNER_OUTPUT"

# Start Rails server (in foreground)
PORT=${PORT:-3000}
echo "[start-web.sh] starting rails server on port $PORT"
exec bundle exec rails server -p "$PORT" -e production -b 0.0.0.0
