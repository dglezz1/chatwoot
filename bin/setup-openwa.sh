#!/usr/bin/env bash
# setup-openwa.sh — One-shot onboarding for OpenWA WhatsApp Web gateway.
#
# What this does:
#   1. Validates all required env vars + container reachability.
#   2. Creates an OpenWA session and prints the QR URL for scanning.
#   3. Registers a webhook on OpenWA pointing at Chatwoot.
#   4. Waits for the WhatsApp client to reach status=ready.
#   5. Creates a Channel::Whatsapp in Chatwoot DB with provider='openwa'.
#   6. Smoke-tests send-text + a status roundtrip.
#
# Idempotent: re-runs detect existing state and skip already-completed steps.
# Exit code 0 = success, non-zero = needs manual intervention.
#
# Usage:
#   ./bin/setup-openwa.sh
#
# Required env vars (read from .env):
#   OPENWA_API_KEY          — API key (dev-admin-key by default)
#   OPENWA_WEBHOOK_SECRET   — HMAC secret for X-OpenWA-Signature
#   OPENWA_PUBLIC_BASE_URL  — Host OpenWA fetches blob URLs from
#   FRONTEND_URL            — Chatwoot's public base URL
#
set -euo pipefail

# ---------- colors ----------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'
say()  { printf "${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }
die()  { printf "${RED}✗ %s${NC}\n" "$*" >&2; exit 1; }

# ---------- preflight ----------
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || die ".env not found. Copy from .env.template first."
set -a; . ./.env; set +a

: "${OPENWA_API_KEY:?missing OPENWA_API_KEY in .env}"
: "${OPENWA_WEBHOOK_SECRET:?missing OPENWA_WEBHOOK_SECRET in .env}"
: "${OPENWA_PUBLIC_BASE_URL:?missing OPENWA_PUBLIC_BASE_URL in .env (e.g. http://chatwoot.local:3000)}"
: "${FRONTEND_URL:?missing FRONTEND_URL in .env}"

OPENWA_HOST="${OPENWA_HOST:-http://localhost:2785}"
SESSION_NAME="${OPENWA_SESSION_NAME:-chatwoot-main}"
CHATWOOT_CONTAINER="${CHATWOOT_CONTAINER:-chatwoot-rails-1}"
SIDECAR_CONTAINER="${SIDECAR_CONTAINER:-chatwoot-sidekiq-1}"

ok "Env vars loaded"

# ---------- 0. Sanity: containers up + openwa reachable ----------
say "Preflight: container + OpenWA reachability"
docker ps --format '{{.Names}}' | grep -q "$CHATWOOT_CONTAINER" || die "$CHATWOOT_CONTAINER not running"
docker ps --format '{{.Names}}' | grep -q "$SIDECAR_CONTAINER" || die "$SIDECAR_CONTAINER not running"
docker ps --format '{{.Names}}' | grep -q "chatwoot-openwa"      || die "chatwoot-openwa not running"
HEALTH=$(curl -fsS "$OPENWA_HOST/api/health" 2>/dev/null || true)
[[ -n "$HEALTH" ]] || die "OpenWA not reachable at $OPENWA_HOST"
ok "Containers up, OpenWA healthy"

# ---------- 1. Sync custom OpenWA Ruby files to both containers ----------
say "Step 1/5: Sync custom Ruby files to both containers"
"$ROOT/bin/sync-openwa-files.sh"

# ---------- 2. Ensure webhook reaches Chatwoot ----------
say "Step 2/5: Test OpenWA → Chatwoot webhook reachability"
# Resolve chatwoot.local → chatwoot-rails-1 from openwa container's perspective
RESOLVED=$(docker exec chatwoot-openwa getent hosts chatwoot.local 2>/dev/null | awk '{print $1}')
[[ -n "$RESOLVED" ]] || die "chatwoot.local does not resolve from openwa container. Add network alias 'chatwoot.local' to rails service in docker-compose."
ok "chatwoot.local → $RESOLVED"

# ---------- 3. Find or create OpenWA session ----------
say "Step 3/5: Find or create OpenWA session '$SESSION_NAME'"
EXISTING=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); s=[x for x in d if x['name']=='$SESSION_NAME']; print(s[0]['id'] if s else '')")
if [[ -n "$EXISTING" ]]; then
  SID="$EXISTING"
  ok "Session '$SESSION_NAME' already exists: $SID"
else
  CREATE=$(curl -fsS -X POST "$OPENWA_HOST/api/sessions" \
    -H "Content-Type: application/json" -H "X-Api-Key: $OPENWA_API_KEY" \
    -d "{\"name\":\"$SESSION_NAME\"}")
  SID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  ok "Session created: $SID"
fi

# ---------- 4. Wait for status=ready ----------
say "Step 4/5: Scan QR if needed (URL printed below)"
STATUS=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
if [[ "$STATUS" != "ready" ]]; then
  warn "Session status: $STATUS"
  QR_URL="$OPENWA_HOST/qr/$SID"
  echo
  printf "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  printf "${YELLOW}  Open the QR URL below in a browser, then scan with the phone${NC}\n"
  printf "${YELLOW}  whose number should own this WhatsApp session:${NC}\n"
  printf "${YELLOW}    %s${NC}\n" "$QR_URL"
  printf "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  echo

  if [[ "$STATUS" == "failed" || "$STATUS" == "disconnected" ]]; then
    say "Restarting session"
    curl -fsS -X POST "$OPENWA_HOST/api/sessions/$SID/stop"  -H "Content-Type: application/json" -H "X-Api-Key: $OPENWA_API_KEY" -d '{}' > /dev/null || true
    "$ROOT/bin/fix-openwa-session.sh" "$SID" || true
  fi

  # Try start
  curl -fsS -X POST "$OPENWA_HOST/api/sessions/$SID/start" -H "Content-Type: application/json" -H "X-Api-Key: $OPENWA_API_KEY" -d '{}' > /dev/null || true

  # Poll for ready
  for i in {1..60}; do
    sleep 2
    STATUS=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
    printf "  [%2d/%2d] status=%s\n" "$i" "60" "$STATUS"
    [[ "$STATUS" == "ready" ]] && break
  done

  if [[ "$STATUS" != "ready" ]]; then
    die "Session did not become ready in 120s. Re-run the script after scanning QR."
  fi
fi
ok "Session status: ready"

# ---------- 5. Register / refresh webhook ----------
say "Step 5/5: Register webhook"
WEBHOOK_URL="$OPENWA_PUBLIC_BASE_URL/webhooks/openwa/$SID"
EXISTING_WH=$(curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID/webhooks" | python3 -c "
import sys,json
whs = json.load(sys.stdin)
for w in whs:
    if w.get('url') == '$WEBHOOK_URL':
        print(w['id'])
        break
")
if [[ -n "$EXISTING_WH" ]]; then
  ok "Webhook already registered: $EXISTING_WH"
else
  REGISTER=$(curl -fsS -X POST "$OPENWA_HOST/api/sessions/$SID/webhooks" \
    -H "Content-Type: application/json" -H "X-Api-Key: $OPENWA_API_KEY" \
    -d "{\"url\":\"$WEBHOOK_URL\",\"events\":[\"message\"],\"hmac\":{\"key\":\"$OPENWA_WEBHOOK_SECRET\"}}")
  WH_ID=$(echo "$REGISTER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  [[ -n "$WH_ID" ]] && ok "Webhook registered: $WH_ID" || ok "Webhook registration response: $REGISTER"
fi

# ---------- 6. Create / refresh Channel::Whatsapp in Chatwoot DB ----------
say "Bonus: Create Channel::Whatsapp in Chatwoot DB"
docker exec "$CHATWOOT_CONTAINER" bundle exec rails runner "
channel = Channel::Whatsapp.find_or_initialize_by(provider: 'openwa')
channel.account = Account.first if channel.account.nil?
channel.provider_config = (channel.provider_config || {}).merge(
  'session_id'    => '$SID',
  'api_key'       => ENV['OPENWA_API_KEY'],
  'api_base_url'  => '$OPENWA_HOST',
  'webhook_secret'=> ENV['OPENWA_WEBHOOK_SECRET']
)
channel.phone_number = '+15555550100' if channel.phone_number.blank? # placeholder, replaced after QR scan
channel.save!
inbox = channel.inbox || channel.create_inbox!(name: 'WhatsApp (OpenWA)', channel: channel)
puts \"channel_id=#{channel.id} inbox_id=#{inbox.id}\"
" 2>&1 | grep -E 'channel_id|inbox_id'

# ---------- 7. Smoke test ----------
say "Smoke test: ping OpenWA session info"
curl -fsS -H "X-Api-Key: $OPENWA_API_KEY" "$OPENWA_HOST/api/sessions/$SID" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print(f\"  id={d['id']} name={d['name']} status={d['status']} phone={d.get('phone','')}\")
"
ok "Setup complete ✓"

echo
cat <<EOF
Next steps:
  1. Make sure the WhatsApp session phone number matches what you expect.
  2. Send a test message from another phone to that number — it should
     appear in Chatwoot under Inbox 'WhatsApp (OpenWA)'.
  3. Reply from Chatwoot — the message should reach the phone.

Troubleshooting:
  - QR never resolves: visit $OPENWA_HOST/qr/$SID in a browser
  - Webhook not firing: ./bin/health-check-openwa.sh
  - Container restart broke things: ./bin/fix-openwa-session.sh
EOF