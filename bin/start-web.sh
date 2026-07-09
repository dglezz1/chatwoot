#!/bin/bash
set -e
export PORT="${PORT:-3000}"
export RAILS_ENV="${RAILS_ENV:-production}"
echo "Starting Rails on port $PORT"
exec bundle exec rails server -p "$PORT" -e "$RAILS_ENV" -b 0.0.0.0
