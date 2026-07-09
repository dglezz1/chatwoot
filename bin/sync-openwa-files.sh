#!/usr/bin/env bash
# sync-openwa-files.sh — Push the project's custom OpenWA Ruby files to
# both rails and sidekiq containers. Required because the Chatwoot
# Docker image bakes code into /app/ — there's no host volume mount,
# so `docker cp` is the only way to update running containers.
#
# Always run this after editing any of these files:
#   app/services/whatsapp/providers/openwa_service.rb
#   app/services/whatsapp/openwa/payload_adapter.rb
#   app/jobs/whatsapp/openwa/lid_identifier_job.rb
#   app/controllers/webhooks/openwa_controller.rb
#   app/controllers/api/v1/accounts/whatsapp/openwa_controller.rb
#   app/models/channel/whatsapp.rb
#   app/models/contact.rb
#   app/views/api/v1/models/_contact.json.jbuilder
#
# Usage:
#   ./bin/sync-openwa-files.sh                  # sync all
#   ./bin/sync-openwa-files.sh file1.rb file2   # sync specific paths
#
# Exit code: 0 success, non-zero on failure.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHATWOOT_CONTAINER="${CHATWOOT_CONTAINER:-chatwoot-rails-1}"
SIDECAR_CONTAINER="${SIDECAR_CONTAINER:-chatwoot-sidekiq-1}"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'
say()  { printf "${BLUE}==>${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
die()  { printf "${RED}✗ %s${NC}\n" "$*" >&2; exit 1; }

# Files that MUST exist on BOTH rails and sidekiq (consumed by both)
BOTH_CONTAINERS=(
  app/services/whatsapp/providers/openwa_service.rb
  app/services/whatsapp/openwa/payload_adapter.rb
  app/jobs/whatsapp/openwa/lid_identifier_job.rb
  app/controllers/webhooks/openwa_controller.rb
  app/controllers/api/v1/accounts/whatsapp/openwa_controller.rb
  app/models/channel/whatsapp.rb
  app/models/contact.rb
)

# Files that ONLY need rails (served by API/webhooks/serializers)
RAILS_ONLY=(
  app/views/api/v1/models/_contact.json.jbuilder
  app/javascript/dashboard/routes/dashboard/conversation/contact/ContactInfo.vue
  app/javascript/dashboard/components-next/Contacts/Pages/ContactsList.vue
  app/javascript/dashboard/components-next/Contacts/EmptyState/ContactEmptyState.vue
)

# Validate container state
for c in "$CHATWOOT_CONTAINER" "$SIDECAR_CONTAINER"; do
  docker ps --format '{{.Names}}' | grep -q "^${c}$" || die "$c not running"
done
ok "Both containers up"

# Build the list of files to sync. If user passed args, use them;
# otherwise sync all known OpenWA files.
if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  FILES=("${BOTH_CONTAINERS[@]}" "${RAILS_ONLY[@]}")
fi

say "Syncing ${#FILES[@]} files"
SYNCED=0
FAILED=0
for f in "${FILES[@]}"; do
  src="$ROOT/$f"
  [[ -f "$src" ]] || { warn "skip $f (not found)"; continue; }

  # Decide target
  if [[ " ${RAILS_ONLY[*]} " == *" $f "* ]]; then
    TARGETS=("$CHATWOOT_CONTAINER")
  else
    TARGETS=("$CHATWOOT_CONTAINER" "$SIDECAR_CONTAINER")
  fi

  for c in "${TARGETS[@]}"; do
    # Make sure parent dir exists in target (docker cp creates dirs
    # at the leaf as directories if they don't exist)
    parent_dir=$(dirname "$f")
    docker exec "$c" mkdir -p "/app/$parent_dir" 2>/dev/null || true
    # Remove any phantom leaf-dir from a previous failed docker cp
    docker exec "$c" rm -rf "/app/$f" 2>/dev/null || true

    if docker cp "$src" "$c:/app/$f" 2>/dev/null; then
      ok "$c:$f"
      SYNCED=$((SYNCED + 1))
    else
      printf "${RED}✗${NC} $c:$f\n"
      FAILED=$((FAILED + 1))
    fi
  done
done

echo
say "Summary: $SYNCED synced, $FAILED failed"
[[ $FAILED -eq 0 ]] || die "Some files failed to sync. Re-run after fixing."

# Verify by listing the file inside each container
say "Verifying files exist in containers"
for c in "$CHATWOOT_CONTAINER" "$SIDECAR_CONTAINER"; do
  echo "  $c:"
  for f in "${BOTH_CONTAINERS[@]}"; do
    if docker exec "$c" test -f "/app/$f" 2>/dev/null; then
      printf "    ${GREEN}✓${NC} %s\n" "$f"
    else
      printf "    ${RED}✗ MISSING${NC} %s\n" "$f"
      FAILED=$((FAILED + 1))
    fi
  done
done

[[ $FAILED -eq 0 ]] || die "$FAILED files missing after sync. Try running again."
ok "All files present in both containers ✓"

cat <<EOF

Next:
  ./bin/restart-openwa-sidekiq.sh   # if you changed provider/model code
  # OR simply: docker restart $CHATWOOT_CONTAINER $SIDECAR_CONTAINER
EOF