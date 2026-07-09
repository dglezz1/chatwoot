#!/bin/bash
# Chambeabot web entrypoint — expands PORT/RAILS_ENV env vars and
# boots the Rails server. Used on Railway where startCommand is invoked
# without a login shell that would do shell expansion.
set -e
: "${PORT:=3000}"
: "${RAILS_ENV:=production}"
export PORT RAILS_ENV
echo "[start-web.sh] PORT=$PORT RAILS_ENV=$RAILS_ENV"
exec bundle exec rails server -p "$PORT" -e "$RAILS_ENV" -b 0.0.0.0
