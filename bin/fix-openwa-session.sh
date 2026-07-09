#!/usr/bin/env bash
# fix-openwa-session.sh — Repair an OpenWA session that won't start,
# usually after a container restart where Chromium left a SingletonLock
# pointing at the old container ID.
#
# What this does:
#   1. Stops the session via API (best-effort).
#   2. Removes SingletonLock/SingletonSocket/SingletonCookie from
#      /app/data/sessions/session-*/ inside the openwa container.
#   3. Restarts the session via API.
#   4. Polls status until ready (up to 60s).
#
# Usage:
#   ./bin/fix-openwa-session.sh                  # uses default session name 'chatwoot-main'
#   ./bin/fix-openwa-session.sh <session-id>     # specific session
#   ./bin/fix-openwa-session.sh <session-id> --qr # if it still fails, force QR rescan
#
# Exit codes: 0 success, 1 session still not ready, 2 invalid args
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { printf "✗ .env not found\n" >&2; exit 2; }
set -a; . ./.env; set +a

: "${OPENWA_API_KEY:?missing OPENWA_API_KEY}"
OPENWA_HOST="${OPENWA_HOST:-http://localhost:2785}"
OPENWA_CONTAINER="${OPENWA_CONTAINER:-chatwoot-openwa}"
SESSION_NAME="${OPENWA_SESSION_NAME:-chatwoot-main}"

# Parse args
SID="${1:-}"
FORCE_QR="${2:-}"

# Resolve session id if not provided
if [[ -z "$SID" ]]; then
  SID=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions" | \
    python3 -c "
import sys,json
s = [x['id'] for x in json.load(sys.stdin) if x['name']=='$SESSION_NAME']
print(s[0] if s else '')
")
  [[ -n "$SID" ]] || { printf "✗ Session '$SESSION_NAME' not found. Run bin/setup-openwa.sh first.\n" >&2; exit 2; }
fi

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'
say()  { printf "${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }

say "Fixing session $SID on $OPENWA_HOST"

# 1. Stop (best-effort)
say "Stop current session"
curl -fsS -X POST "$OPENWA_HOST/api/sessions/$SID/stop" \
  -H "Content-Type: application/json" -H "X-Api-Key: $OPENWA_API_KEY" -d '{}' \
  > /dev/null 2>&1 || warn "Stop returned error (may already be stopped)"
sleep 2

# 2. Remove chromium lock files
say "Clear Chromium SingletonLock from $OPENWA_CONTAINER"
docker exec "$OPENWA_CONTAINER" sh -c "
  find /app/data/sessions -name 'SingletonLock'   -delete 2>/dev/null
  find /app/data/sessions -name 'SingletonSocket' -delete 2>/dev/null
  find /app/data/sessions -name 'SingletonCookie' -delete 2>/dev/null
  echo '  locks cleared'
" || warn "Lock cleanup failed (may not need it)"

# 3. Restart
say "Start session"
if [[ "$FORCE_QR" == "--qr" ]]; then
  warn "Force-rescan: deleting session data"
  docker exec "$OPENWA_CONTAINER" sh -c "
    rm -rf /app/data/sessions/session-*
    echo '  session data wiped'
  "
fi

START_RESP=$(curl -fsS -X POST "$OPENWA_HOST/api/sessions/$SID/start" \
  -H "Content-Type: application/json" -H "X-Api-Key: $OPENWA_API_KEY" -d '{}' 2>&1) || true
echo "  start: $START_RESP"

# 4. Poll for ready
say "Polling status (max 90s)"
for i in $(seq 1 45); do
  sleep 2
  STATUS=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "error")
  printf "  [%2d/%2d] status=%s\n" "$i" "45" "$STATUS"
  [[ "$STATUS" == "ready" ]] && break
done

FINAL=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "error")
if [[ "$FINAL" != "ready" ]]; then
  printf "${RED}✗ Session did not reach status=ready (last status: $FINAL)${NC}\n"
  echo
  echo "  If status is 'initializing' or 'disconnected', the existing session is still"
  echo "  trying to reconnect — wait a minute and re-run this script."
  echo
  echo "  If you need to force a fresh QR scan, run:"
  echo "    ./bin/fix-openwa-session.sh $SID --qr"
  echo
  echo "  Then visit $OPENWA_HOST/qr/$SID and rescan with your phone."
  exit 1
fi

ok "Session is ready ✓"

# 5. Verify webhook still registered
WH_COUNT=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID/webhooks" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
ok "Webhooks registered: $WH_COUNT"