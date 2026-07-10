# Chambeabot email-relay — Cloudflare Email Worker

Receives inbound mail via Cloudflare Email Routing and forwards the raw
RFC822 payload to Chatwoot's ActionMailbox relay endpoint
(`/rails/action_mailbox/relay/inbound_emails`).

## Why this exists

Cloudflare Email Routing is the cheapest way to receive mail on
`@chambeabot.com` (free, no mailbox hosting). The route is:
`MX → Cloudflare Email Routing → Email Worker → our Worker → Chatwoot relay`.

Outbound (sending) is handled separately by **Resend SMTP** configured
in `crm-web` + `crm-worker` env. This Worker only handles inbound.

## Setup

### 1. Cloudflare side

```bash
cd cloudflare-workers/email-relay
npm install
npx wrangler login   # one-time
npx wrangler deploy

# Set secrets (don't commit these)
npx wrangler secret put CHATWOOT_RELAY_URL
# → https://crm.chambeabot.com/rails/action_mailbox/relay/inbound_emails

npx wrangler secret put CHATWOOT_EMAIL_BRIDGE_TOKEN
# → any long random string (openssl rand -hex 32)
```

### 2. Email Routing — bind the Worker

In Cloudflare dashboard:
- Go to **Email → Email Routing → Routes**
- Either:
  - Add a **catch-all** route for `@chambeabot.com` and set "Action" to
    "Send to a Worker" → `chambeabot-email-relay`. Or
  - Add a specific route for `support@chambeabot.com` (recommended;
    narrower blast radius if the Worker ever errors).

### 3. Chatwoot side — create the inbox

In the Chatwoot dashboard:
- Settings → Inboxes → Add → **Email**
- Email: `support@chambeabot.com` (this MUST match what the route binds to)
- Forward to email: any internal mailbox (where bounces go) — can be a
  Cloudflare-only alias like `bounces@chambeabot.com`
- IMAP: leave disabled unless you also want bidirectional sync
  (Cloudflare already routes everything inbound for you).

## How a message flows

1. Customer writes to `support@chambeabot.com`.
2. Cloudflare MX receives the email at the edge.
3. Email Routing rule matches → invokes our Worker.
4. Worker's `email()` handler reads the raw RFC822 body, adds
   `X-Original-*` headers, POSTs to Chatwoot's relay endpoint.
5. Chatwoot's `ActionMailbox::Relay` controller inspects the `To:` header,
   finds the matching `Channel::Email` by `email` field, and creates a
   new Conversation + Message in that inbox.
6. If the inbox has an assigned agent or Captain AI, the message hits
   the normal pipeline (notification, auto-reply, etc.).

## Operational notes

- **At-least-once delivery**: Cloudflare retries on 5xx, so transient
  Chatwoot downtime won't drop mail. We rely on the `Message-ID` header
  being preserved for dedup.
- **Bounces**: outgoing mail from Chatwoot (verification emails, etc.)
  uses the `MAILER_SENDER_EMAIL` env var. Bounce replies to that address
  will also be caught by the same Worker; Chatwoot will mark them as
  bounced via the `default` mailbox.
- **Spam**: Cloudflare Email Routing includes basic spam filtering
  (Rspamd). The Worker passes the original raw email through unchanged.
- **PII**: raw email bodies contain PII. Keep the Worker secret-backed
  relay URL private; the raw email is stored in Chatwoot's PG. Make sure
  your Railway PG has backups + access controls in production.
