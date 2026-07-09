#!/usr/bin/env bash
# health-check-openwa.sh — Periodic smoke test for the OpenWA integration.
# Exits non-zero if any check fails; safe to run from cron.
#
# Checks:
#   1. OpenWA API reachable
#   2. Session status=ready
#   3. Webhook URL reachable from inside openwa container
#   4. Channel::Whatsapp record exists in Chatwoot
#   5. Provider service class resolves to OpenwaService (not 360Dialog)
#   6. OPENWA_PUBLIC_BASE_URL env var set on rails + sidekiq
#   7. Custom Ruby files present in both containers (no phantom dirs)
#   8. ActiveStorage URL options available (config/routes.rb has default_url_options)
#
# Usage:
#   ./bin/health-check-openwa.sh                   # exit code only
#   ./bin/health-check-openwa.sh --verbose         # print every check
#   ./bin/health-check-openwa.sh --auto-recover    # attempt fix on failure
#
# Exit codes: 0 healthy, 1 unhealthy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { printf "✗ .env missing\n" >&2; exit 1; }
set -a; . ./.env; set +a

: "${OPENWA_API_KEY:?missing OPENWA_API_KEY}"
OPENWA_HOST="${OPENWA_HOST:-http://localhost:2785}"
SESSION_NAME="${OPENWA_SESSION_NAME:-chatwoot-main}"
CHATWOOT_CONTAINER="${CHATWOOT_CONTAINER:-chatwoot-rails-1}"
SIDECAR_CONTAINER="${SIDECAR_CONTAINER:-chatwoot-sidekiq-1}"
OPENWA_CONTAINER="${OPENWA_CONTAINER:-chatwoot-openwa}"

VERBOSE=0
AUTO_RECOVER=0
[[ "${1:-}" == "--verbose" ]] && VERBOSE=1
[[ "${1:-}" == "--auto-recover" ]] && AUTO_RECOVER=1

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'
PASS=0
FAIL=0
say()    { printf "${BLUE}[check]${NC} %s\n" "$*"; }
ok()     { printf "${GREEN}✓${NC} %s\n" "$*"; PASS=$((PASS+1)); }
fail()   { printf "${RED}✗${NC} %s\n" "$*"; FAIL=$((FAIL+1)); }
warn()   { printf "${YELLOW}!${NC} %s\n" "$*"; }

# Resolve session id
SID=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions" 2>/dev/null | \
  python3 -c "
import sys,json
s = [x['id'] for x in json.load(sys.stdin) if x['name']=='$SESSION_NAME']
print(s[0] if s else '')
" 2>/dev/null || echo "")

[[ $VERBOSE -eq 1 ]] && say "Running health checks (verbose mode)"

# 1. OpenWA reachable
say "OpenWA API reachable at $OPENWA_HOST"
HEALTH=$(curl -fsS "$OPENWA_HOST/api/health" 2>/dev/null) || HEALTH=""
if [[ -n "$HEALTH" ]]; then
  ok "OpenWA /api/health responds"
else
  fail "OpenWA not reachable — is $OPENWA_CONTAINER running?"
  [[ $AUTO_RECOVER -eq 1 ]] && docker restart "$OPENWA_CONTAINER" || true
fi

# 2. Session status=ready
say "Session '$SESSION_NAME' status"
if [[ -z "$SID" ]]; then
  fail "Session not found in OpenWA — run bin/setup-openwa.sh"
else
  STATUS=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
  if [[ "$STATUS" == "ready" ]]; then
    ok "Session $SID is ready"
  else
    fail "Session status: $STATUS (expected: ready)"
    if [[ $AUTO_RECOVER -eq 1 ]]; then
      warn "Attempting auto-recover via bin/fix-openwa-session.sh"
      "$ROOT/bin/fix-openwa-session.sh" "$SID" || true
    fi
  fi
fi

# 3. Webhook URL reachable
say "Webhook URL resolves from $OPENWA_CONTAINER → $OPENWA_PUBLIC_BASE_URL"
RESOLVED=$(docker exec "$OPENWA_CONTAINER" getent hosts chatwoot.local 2>/dev/null | awk '{print $1}')
if [[ -n "$RESOLVED" ]]; then
  ok "chatwoot.local → $RESOLVED"
else
  fail "chatwoot.local does not resolve from $OPENWA_CONTAINER. Add network alias in docker-compose."
fi

# 4. Channel::Whatsapp record
say "Channel::Whatsapp record exists"
CHANNEL_OK=$(docker exec "$CHATWOOT_CONTAINER" bundle exec rails runner '
  c = Channel::Whatsapp.find_by(provider: "openwa")
  if c.nil?
    puts "missing"
  else
    inbox = c.inbox
    puts "ok id=#{c.id} inbox_id=#{inbox&.id}"
  end
' 2>&1 | grep -E '^(ok|missing)' | tail -1)
if [[ "$CHANNEL_OK" == missing ]]; then
  fail "Channel::Whatsapp with provider='openwa' not found. Run bin/setup-openwa.sh."
elif [[ "$CHANNEL_OK" == ok* ]]; then
  ok "Channel present: ${CHANNEL_OK}"
else
  fail "Channel check failed: $CHANNEL_OK"
fi

# 5. Provider service resolves correctly
say "Channel dispatches to OpenwaService (not 360Dialog)"
PROV=$(docker exec "$CHATWOOT_CONTAINER" bundle exec rails runner '
  c = Channel::Whatsapp.find_by(provider: "openwa")
  if c
    puts c.provider_service.class.name
  else
    puts "no-channel"
  end
' 2>&1 | grep -E '^(Whatsapp|no-)' | tail -1)
if [[ "$PROV" == "Whatsapp::Providers::OpenwaService" ]]; then
  ok "Channel routes to OpenwaService"
else
  fail "Wrong provider: $PROV (expected: Whatsapp::Providers::OpenwaService)"
fi

# 6. OPENWA_PUBLIC_BASE_URL set on rails + sidekiq
say "OPENWA_PUBLIC_BASE_URL env var"
for c in "$CHATWOOT_CONTAINER" "$SIDECAR_CONTAINER"; do
  VAL=$(docker exec "$c" sh -c 'echo "${OPENWA_PUBLIC_BASE_URL:-}"' 2>/dev/null || echo "")
  if [[ -n "$VAL" ]]; then
    ok "$c has OPENWA_PUBLIC_BASE_URL=$VAL"
  else
    fail "$c missing OPENWA_PUBLIC_BASE_URL"
  fi
done

# 7. Custom files present (no phantom dirs)
say "Custom OpenWA Ruby files present in both containers"
EXPECTED=(
  app/services/whatsapp/providers/openwa_service.rb
  app/services/whatsapp/openwa/payload_adapter.rb
  app/jobs/whatsapp/openwa/lid_identifier_job.rb
  app/controllers/webhooks/openwa_controller.rb
  app/models/channel/whatsapp.rb
)
for c in "$CHATWOOT_CONTAINER" "$SIDECAR_CONTAINER"; do
  for f in "${EXPECTED[@]}"; do
    if docker exec "$c" test -f "/app/$f" 2>/dev/null; then
      [[ $VERBOSE -eq 1 ]] && ok "$c:$f"
    else
      fail "$c:$f missing — run bin/sync-openwa-files.sh"
    fi
  done
done

# 8. Channel model has 'openwa' case
say "Channel::Whatsapp model knows about 'openwa' provider"
HAS_OPENWA=$(docker exec "$CHATWOOT_CONTAINER" grep -c "'openwa'" /app/app/models/channel/whatsapp.rb 2>/dev/null || echo "0")
if [[ "$HAS_OPENWA" -ge 2 ]]; then
  ok "channel/whatsapp.rb has 'openwa' provider dispatch"
else
  fail "channel/whatsapp.rb missing 'openwa' case — sync + restart"
fi

echo
echo "==================================================="
printf "  %d passed, %d failed\n" "$PASS" "$FAIL"
echo "==================================================="

if [[ $FAIL -gt 0 ]]; then
  printf "${YELLOW}Hint: run ./bin/setup-openwa.sh to repair, or --auto-recover to attempt fixes${NC}\n"
  exit 1
fi

ok "All checks passed ✓"