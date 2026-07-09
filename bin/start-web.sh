#!/bin/bash
set -e
echo "PORT from env: '$PORT'"
echo "RAILS_ENV from env: '$RAILS_ENV'"
echo "PATH=$PATH"
# Hardcoded for testing
export PORT=3000
export RAILS_ENV=production
exec bundle exec rails server -p "$PORT" -e "$RAILS_ENV" -b 0.0.0.0
