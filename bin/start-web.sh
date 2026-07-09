#!/bin/bash
set -e
: "${PORT:=3000}"
: "${RAILS_ENV:=production}"
export PORT RAILS_ENV
exec bundle exec rails server -p "$PORT" -e "$RAILS_ENV" -b 0.0.0.0
