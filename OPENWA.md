# OpenWA WhatsApp Web Gateway — Chatwoot Integration

OpenWA is a WhatsApp Web API Gateway (uses whatsapp-web.js under the hood).
This integration replaces the Meta WhatsApp Business API with OpenWA so we
can run a WhatsApp inbox without Meta's business verification.

## TL;DR — 1-shot setup

```bash
cd ~/Developer/chatwoot

# 1. Add to .env (if not already):
cat >> .env <<EOF
OPENWA_API_KEY=dev-admin-key
OPENWA_WEBHOOK_SECRET=$(openssl rand -hex 16)
OPENWA_PUBLIC_BASE_URL=http://chatwoot.local:3000
EOF

# 2. Bring up the stack
docker compose -f docker-compose.production.yaml up -d

# 3. One-shot onboarding
make setup

# 4. Scan the QR it prints with the phone whose number should own the inbox

# 5. Verify
make health
```

That's it. The script handles session creation, webhook registration, and
the Channel::Whatsapp DB record.

## Architecture

```
┌─────────────────┐   HTTPS   ┌──────────────────┐
│ Customer Phone  │◀─────────▶│ OpenWA Container │
│   (WhatsApp)    │           │  whatsapp-web.js │
└─────────────────┘           └────────┬─────────┘
                                       │ webhooks
                                       │ X-OpenWA-Signature
                                       ▼
┌─────────────────────────────────────────────────────────┐
│ Chatwoot Rails (port 3000)                                │
│   POST /webhooks/openwa/:sessionId                       │
│     → Webhooks::OpenwaController#process_payload          │
│       → Whatsapp::IncomingMessageService                 │
│         → Chatwoot::Conversations + Messages.create!     │
│                                                          │
│   Outbound (Sidekiq worker):                             │
│     SendReplyJob → Whatsapp::Providers::OpenwaService    │
│       → POST http://openwa:2785/api/.../send-{type}     │
└─────────────────────────────────────────────────────────┘
```

The OpenWA container runs `whatsapp-web.js` (a Puppeteer-driven Chrome
instance) that talks to real WhatsApp servers. Chatwoot talks to OpenWA's
REST API instead of Meta Cloud.

## Files added by this integration

```
app/services/whatsapp/providers/openwa_service.rb        # Core provider
app/services/whatsapp/openwa/payload_adapter.rb         # Webhook → Chatwoot format
app/jobs/whatsapp/openwa/lid_identifier_job.rb          # Persists @lid chatId
app/controllers/webhooks/openwa_controller.rb           # Webhook receiver
app/controllers/api/v1/accounts/whatsapp/openwa_controller.rb  # Session mgmt API
app/models/channel/whatsapp.rb                           # 'openwa' case in PROVIDERS
app/models/contact.rb                                    # display_phone (pushName vs E164)
app/views/api/v1/models/_contact.json.jbuilder           # + display_phone field
app/javascript/...                                       # Frontend display_phone
docker-compose.production.yaml                           # + openwa service, env vars
.env                                                      # + OPENWA_* vars
bin/setup-openwa.sh                                       # 1-shot onboarding
bin/sync-openwa-files.sh                                  # Sync files to containers
bin/fix-openwa-session.sh                                 # Repair session
bin/health-check-openwa.sh                                # 8-check health probe
bin/backfill-openwa-lids.rb                               # Migration for existing contacts
Makefile                                                   # Common ops
```

## Operations

```bash
make help              # List all targets
make status            # Container + session status
make health            # 8-check health probe (exit non-zero on failure)
make health-auto       # Health + attempt auto-recover on failure
make logs              # Tail rails logs
make logs-sidekiq      # Tail sidekiq logs (where SendReplyJob runs)
make logs-openwa       # Tail openwa logs
make sync              # Re-sync custom files to both containers
make restart           # Restart rails + sidekiq
make sync-restart      # Sync + restart (run after editing provider/model code)
make fix-session       # Repair OpenWA session after container restart
make backfill          # Backfill openwa_chat_id for existing contacts
make rebuild-vite      # Rebuild frontend assets (needs ≥4GB heap)
```

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Failed to open TCP connection to waba.360dialog.io` | Sidekiq didn't pick up the OpenwaService class | `make sync-restart` |
| HTTP 400 `property audio should not exist` | Old Meta-nested payload (fixed in this branch) | `make sync-restart` |
| HTTP 400 `url must be a URL address` | `OPENWA_PUBLIC_BASE_URL` not set on rails/sidekiq | Set env var in `.env`, `make sync-restart` |
| HTTP 500 `t: t` from OpenWA | Audio sent as `audio/wav` — whatsapp-web.js rejects | Use `audio/ogg` (Opus) |
| `Cannot generate URL for X using Disk service` | ActiveStorage url_options missing in Sidekiq context | Fixed in `OpenwaService#send_attachment_message` |
| Session `disconnected` after restart | Chromium SingletonLock from old container ID | `make fix-session` or `make fix-session-qr` |
| Container restart wipes `/app/app/services/whatsapp/openwa/` | Files baked into image, no volume mount | `make sync` to re-copy |
| Webhooks not firing | Network alias `chatwoot.local` missing on rails service | Add to `docker-compose.production.yaml` `networks.default.aliases` |

## Environment variables

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `OPENWA_API_KEY` | yes | `dev-admin-key` | OpenWA X-Api-Key auth header |
| `OPENWA_WEBHOOK_SECRET` | yes | — | HMAC secret for `X-OpenWA-Signature` |
| `OPENWA_PUBLIC_BASE_URL` | yes | `http://chatwoot.local:3000` | Host OpenWA fetches blob URLs from (must resolve from OpenWA container) |
| `OPENWA_HOST` | no | `http://localhost:2785` | OpenWA base URL for Chatwoot to call |
| `OPENWA_SESSION_NAME` | no | `chatwoot-main` | Default session name |
| `FRONTEND_URL` | yes (existing) | — | Chatwoot's public URL (used for survey links, etc.) |

## Supported features

| Feature | Status | Notes |
|---------|--------|-------|
| Text (in/out) | ✅ | `quotedMessageId` supported for replies |
| Image (in/out) | ✅ | PNG/JPG/etc. via `send-image` |
| Audio/voice note (out) | ✅ | **Must use `audio/ogg` (Opus)**; WAV fails |
| Audio/voice (in) | ✅ | `ptt` from whatsapp-web.js maps to `audio` |
| Document (in/out) | ✅ | PDF, ZIP, etc. via `send-document` |
| Video (in/out) | ✅ | via `send-video` |
| Sticker (in/out) | ✅ | WebP via `send-sticker` |
| Reactions (in/out) | ✅ | `message.reaction` event + `send-reply/react` endpoint |
| Group messages (in/out) | ✅ | `chatId` ending `@g.us` |
| Private numbers (LID, in/out) | ✅ | `chatId` ending `@lid`, requires `additional_attributes.openwa_chat_id` |
| Quoted message reply | ✅ | via `in_reply_to_external_id` in content_attributes |
| Voice messages (out) | ✅ | Marked via `meta.is_voice_message` |
| input_select (interactive buttons) | ⚠️ Renders as text | OpenWA has no interactive button support |
| Templates | ❌ | OpenWA limitation; raises `NotImplementedError` |
| Location (out) | ❌ | OpenWA bug `Location is not a constructor` |
| Contact cards (out) | ⚠️ Endpoint exists | Not validated for full vCard schema |

## Development workflow

When editing OpenWA provider code:

```bash
# 1. Edit the file
$EDITOR app/services/whatsapp/providers/openwa_service.rb

# 2. Sync to containers
make sync

# 3. Restart sidekiq (always) and rails (if you changed models/views)
make restart

# 4. Verify
make health

# 5. Send a test message from another phone → check sidekiq logs
make logs-sidekiq | grep OPENWA
```

When editing frontend:

```bash
$EDITOR app/javascript/dashboard/components-next/.../*.vue
make rebuild-vite   # rebuilds the bundle inside the container
make restart        # rails serves the new bundle
```

## Health monitoring

A cron task `openwa-health` runs every 5 minutes via `mavis cron`:

```bash
mavis cron list mavis  # show
mavis cron delete mavis openwa-health  # disable
```

On failure it auto-attempts `make health-auto` (runs `bin/fix-openwa-session.sh`)
and emits a `<mavis-progress>` tag. The memory note about cron SIGKILLs
applies — only `mavis-progress` tags work in cron-executor context; do
not add `mavis im send` calls.

## Memory / doc references

This stack's gotchas are documented in:

- `~/.mavis/agents/mavis/memory/chatwoot-openwa.md` — cross-project knowledge
  about OpenWA API quirks, `@c.us` / `@lid` / `@g.us` chatId formats,
  and ContactInbox.source_id regex workaround.
- `~/Developer/chatwoot/AGENTS.md` — project-specific deployment notes
  (dual-container `docker cp`, network alias, `OPENWA_PUBLIC_BASE_URL`).
- `~/Developer/chatwoot/Makefile` — common ops.