#!/bin/bash
# Just start Rails, with explicit PORT
PORT=${PORT:-3000}
exec bundle exec rails server -p "$PORT" -e production -b 0.0.0.0 2>&1
