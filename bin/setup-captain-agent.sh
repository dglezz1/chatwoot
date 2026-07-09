#!/usr/bin/env bash
# setup-captain-agent.sh — Create a Captain AI agent with training data and
# guardrails in one shot.
#
# Sources of training data:
#   --url URL          Web page (single or sitemap; scraped by
#                      SimplePageCrawlService, or Firecrawl if configured)
#   --pdf PATH         Local PDF file (uploaded, parsed via OpenAI Files API)
#   --text "..."       Inline text/FAQ/markdown content
#   --text-file PATH   Read text from a local file
#   --config-yaml PATH Read full agent spec from YAML (see --config-schema)
#
# Guardrails and scenarios:
#   --guardrail "..."  Hard rule the AI cannot break (repeatable)
#   --guideline "..."  Soft style/tone rule (repeatable)
#   --scenario 'title=Refund request|description=...|instruction=...'
#                      (repeatable; pipe-separated)
#
# Required (or use --config-yaml):
#   --name "..."
#   --description "..."
#   --instructions "..."
#
# Output: prints the agent id + document/scenario ids; agent starts processing
# web/PDF sources in the background (CrawlJob).
#
# Usage:
#   ./bin/setup-captain-agent.sh \
#     --name "Customer Support" \
#     --description "Answers questions about MyApp" \
#     --instructions "You are a helpful support agent. Be concise." \
#     --url https://docs.example.com \
#     --url https://example.com/pricing \
#     --pdf /path/to/manual.pdf \
#     --text "FAQ: We ship within 24 hours." \
#     --guardrail "Never share internal pricing" \
#     --guideline "Reply in the customer's language" \
#     --scenario 'title=Refund|description=Customer wants refund|instruction=Ask for order id'
#
#   ./bin/setup-captain-agent.sh --config-yaml ./my-agent.yml --account-id 1
#
# Exit codes: 0 success, 1 input error, 2 server error.
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f .env ]] || { printf "✗ .env missing\n" >&2; exit 1; }
set -a; . ./.env; set +a

: "${CHATWOOT_API_TOKEN:?missing CHATWOOT_API_TOKEN in .env (or use --api-token)}"
: "${FRONTEND_URL:?missing FRONTEND_URL in .env}"
API_BASE="${API_BASE:-${FRONTEND_URL}/api/v1}"

# ---------- Parse args ----------
NAME=""; DESCRIPTION=""; INSTRUCTIONS=""
PRODUCT_NAME=""; TEMP="1.0"
URLS=(); PDFS=(); TEXTS=(); GUARDRAILS=(); GUIDELINES=(); SCENARIOS=()
CONFIG_YAML=""
ACCOUNT_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)            NAME="$2"; shift 2 ;;
    --description)     DESCRIPTION="$2"; shift 2 ;;
    --instructions)    INSTRUCTIONS="$2"; shift 2 ;;
    --product-name)    PRODUCT_NAME="$2"; shift 2 ;;
    --temperature)     TEMP="$2"; shift 2 ;;
    --url)             URLS+=("$2"); shift 2 ;;
    --pdf)             PDFS+=("$2"); shift 2 ;;
    --text)            TEXTS+=("$2"); shift 2 ;;
    --text-file)       TEXTS+=("$(cat "$2")"); shift 2 ;;
    --guardrail)       GUARDRAILS+=("$2"); shift 2 ;;
    --guideline)       GUIDELINES+=("$2"); shift 2 ;;
    --scenario)        SCENARIOS+=("$2"); shift 2 ;;
    --config-yaml)     CONFIG_YAML="$2"; shift 2 ;;
    --account-id)      ACCOUNT_ID="$2"; shift 2 ;;
    --api-base)        API_BASE="$2"; shift 2 ;;
    --api-token)       CHATWOOT_API_TOKEN="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//' | head -50
      exit 0
      ;;
    *) printf "✗ unknown arg: %s\n" "$1" >&2; exit 1 ;;
  esac
done

# ---------- Load YAML config if provided ----------
if [[ -n "$CONFIG_YAML" ]]; then
  [[ -f "$CONFIG_YAML" ]] || { printf "✗ config file not found: %s\n" "$CONFIG_YAML" >&2; exit 1; }

  # Lightweight YAML parsing via python (no PyYAML dependency needed for flat keys)
  if command -v python3 >/dev/null 2>&1; then
    eval "$(python3 -c "
import sys, yaml, json
with open('$CONFIG_YAML') as f:
    data = yaml.safe_load(f) or {}
agent = data.get('agent', data)
def emit(key, val):
    if isinstance(val, list):
        print(f'{key}=({ \"\".join(repr(x)+' ' for x in val) })')
    else:
        print(f'{key}={repr(val)}')
for k in ['name','description','instructions','product_name']:
    emit(k, agent.get(k, ''))
emit('TEMP', agent.get('temperature', 1.0))
for url in agent.get('urls', []): print(f'URLS+=(\"{url}\")')
for pdf in agent.get('pdfs', []): print(f'PDFS+=(\"{pdf}\")')
for txt in agent.get('texts', []): print(f'TEXTS+=({repr(txt)})')
for g in agent.get('guardrails', []): print(f'GUARDRAILS+=({repr(g)})')
for g in agent.get('response_guidelines', []): print(f'GUIDELINES+=({repr(g)})')
for s in agent.get('scenarios', []):
    pipe = '|'.join(f'{k}={v}' for k,v in s.items())
    print(f'SCENARIOS+=({repr(pipe)})')
emit('ACCOUNT_ID', agent.get('account_id', ''))
" 2>/dev/null)"
  else
    printf "✗ YAML parsing needs python3 + pyyaml. Run: pip3 install pyyaml\n" >&2
    exit 1
  fi
fi

# ---------- Validate required ----------
[[ -n "$NAME" ]]          || { printf "✗ --name is required\n" >&2; exit 1; }
[[ -n "$DESCRIPTION" ]]   || { printf "✗ --description is required\n" >&2; exit 1; }
[[ -n "$INSTRUCTIONS" ]]  || { printf "✗ --instructions is required\n" >&2; exit 1; }

if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID=$(curl -fsS -H "api_access_token: $CHATWOOT_API_TOKEN" "$API_BASE/accounts" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['payload'][0]['id'])" 2>/dev/null || echo "")
  [[ -n "$ACCOUNT_ID" ]] || { printf "✗ could not auto-detect account_id; pass --account-id\n" >&2; exit 1; }
fi

# ---------- Build JSON payload ----------
# Convert bash array → JSON array. Empty arrays must stay empty `[]` — using
# `"${ARR[@]:-}"` would yield a single empty string `[""]` which the controller
# then parses as a document with empty `source`.
to_json_array() {
  # Bash `set -u` makes "${ARR[@]}" error out when the array is empty in
  # some contexts. Use $# (number of args) instead — works regardless.
  if [[ $# -eq 0 ]]; then
    echo "[]"
  else
    python3 -c "import sys,json; print(json.dumps(sys.argv[1:]))" "$@"
  fi
}

URLS_JSON=$(to_json_array "${URLS[@]}")
PDFS_JSON=$(to_json_array "${PDFS[@]}")
TEXTS_JSON=$(to_json_array "${TEXTS[@]}")
GUARDRAILS_JSON=$(to_json_array "${GUARDRAILS[@]}")
GUIDELINES_JSON=$(to_json_array "${GUIDELINES[@]}")
SCENARIOS_JSON='[]'
if [[ ${#SCENARIOS[@]} -gt 0 ]]; then
  SCEN_QUOTED=$(printf '%q\n' "${SCENARIOS[@]}")
  SCENARIOS_JSON=$(SCEN_QUOTED="$SCEN_QUOTED" python3 -c '
import json, os
raw = os.environ["SCEN_QUOTED"]
scenarios = []
for s in raw.splitlines():
    s = s.strip().strip("\"'\''")
    if not s:
        continue
    parts = dict(p.split("=", 1) for p in s.split("|") if "=" in p)
    scenarios.append(parts)
print(json.dumps(scenarios))
')
fi

# Build the documents array — use -c with embedded vars (heredoc would go to STDIN)
DOCS_JSON=$(URLS_JSON="$URLS_JSON" PDFS_JSON="$PDFS_JSON" TEXTS_JSON="$TEXTS_JSON" \
python3 -c '
import json, os
urls   = json.loads(os.environ["URLS_JSON"])
pdfs   = json.loads(os.environ["PDFS_JSON"])
texts  = json.loads(os.environ["TEXTS_JSON"])
docs = []
for u in urls:  docs.append({"type": "url",  "source": u})
for p in pdfs:  docs.append({"type": "pdf",  "source": p})
for t in texts: docs.append({"type": "text", "source": t})
print(json.dumps(docs))
')

PAYLOAD=$(NAME="$NAME" DESCRIPTION="$DESCRIPTION" INSTRUCTIONS="$INSTRUCTIONS" \
  TEMP="$TEMP" PRODUCT_NAME="$PRODUCT_NAME" \
  GUARDRAILS_JSON="$GUARDRAILS_JSON" GUIDELINES_JSON="$GUIDELINES_JSON" \
  SCENARIOS_JSON="$SCENARIOS_JSON" DOCS_JSON="$DOCS_JSON" \
python3 -c '
import json, os
agent = {
    "name": os.environ["NAME"],
    "description": os.environ["DESCRIPTION"],
    "instructions": os.environ["INSTRUCTIONS"],
    "temperature": float(os.environ["TEMP"]),
}
pn = os.environ.get("PRODUCT_NAME", "")
if pn:
    agent["product_name"] = pn
agent["guardrails"]         = json.loads(os.environ["GUARDRAILS_JSON"])
agent["response_guidelines"] = json.loads(os.environ["GUIDELINES_JSON"])
agent["scenarios"]          = json.loads(os.environ["SCENARIOS_JSON"])
agent["documents"]          = json.loads(os.environ["DOCS_JSON"])
print(json.dumps({"agent": agent}))
')

# ---------- Send ----------
say()  { printf "${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
die()  { printf "${RED}✗ %s${NC}\n" "$*" >&2; exit 2; }
BLUE=$'\033[0;34m'
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
NC=$'\033[0m'

say "Creating agent '$NAME' on account $ACCOUNT_ID"
say "  ${#URLS[@]} URLs, ${#PDFS[@]} PDFs, ${#TEXTS[@]} text docs"
say "  ${#GUARDRAILS[@]} guardrails, ${#GUIDELINES[@]} guidelines, ${#SCENARIOS[@]} scenarios"

RESP_FILE=$(mktemp)
HTTP_CODE=$(curl -sS -o "$RESP_FILE" -w '%{http_code}' \
  -X POST "$API_BASE/accounts/$ACCOUNT_ID/captain/agents" \
  -H "api_access_token: $CHATWOOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [[ "$HTTP_CODE" != "201" ]]; then
  printf "${RED}✗ HTTP $HTTP_CODE${NC}\n" >&2
  cat "$RESP_FILE" >&2
  rm -f "$RESP_FILE"
  exit 2
fi

ok "Agent created (HTTP $HTTP_CODE)"
echo
python3 - "$RESP_FILE" << 'PYEOF'
import json, sys
r = json.load(open(sys.argv[1]))
print(f"  Agent ID:   {r.get('id')}")
print(f"  Name:       {r.get('name')}")
print(f"  Description: {r.get('description')[:80]}")
print(f"  Guardrails: {len(r.get('guardrails') or [])}")
print(f"  Guidelines: {len(r.get('response_guidelines') or [])}")
print(f"  Scenarios:  {len(r.get('scenarios') or [])}")
print(f"  Documents:  {len(r.get('documents') or [])}")
for d in r.get('documents', []):
    note = ''
    if d.get('status') == 'in_progress':
        note = f" (crawl in progress, {d.get('content_length') or 0} chars indexed so far)"
    elif d.get('has_pdf'):
        note = ' (PDF processing in background)'
    print(f"    • [{d.get('type')}] {d.get('name')} — {d.get('status')}{note}")
PYEOF

rm -f "$RESP_FILE"
echo
say "Next steps:"
echo "  • Open Chatwoot → Settings → Captain → Assistants to fine-tune"
echo "  • Link an inbox via POST /api/v1/accounts/$ACCOUNT_ID/captain/assistants/{id}/inboxes"
echo "  • Or test in the playground: POST .../assistants/{id}/playground"