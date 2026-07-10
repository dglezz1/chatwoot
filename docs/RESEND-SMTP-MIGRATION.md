# Chambeabot SMTP → Resend Migration

## TL;DR

Railway Hobby plan **blocks outbound SMTP ports 25/465/587/2525** to prevent spam.
We worked around it by adding a custom ActionMailer delivery method
(`Mail::ResendDelivery` in `lib/mail/resend_delivery.rb`) that calls the
**Resend HTTP API** (port 443) instead. The end-to-end pipeline is wired
and verified on the live crm-worker: when triggered, the worker now reaches
`api.resend.com` over HTTPS. The only thing left is a real Resend API key.

## What's already done (don't redo)

- `lib/mail/resend_delivery.rb` — the custom delivery class (HTTPS POST to Resend).
- `config/initializers/mailer.rb` — registers `:resend` as a delivery method
  via `ActionMailer::Base.add_delivery_method`, and sets both
  `config.action_mailer.delivery_method = :resend` AND
  `ActionMailer::Base.delivery_method = :resend` (the latter is required
  because the ActionMailer railtie runs *before* user initializers and
  only mutates the OrderedOptions hash on first load).
- `MAILER_DELIVERY_METHOD=resend` is set on crm-web and crm-worker.
- `RESEND_API_BASE=https://api.resend.com` is set on both.
- `MAILER_SENDER_EMAIL="Chambeabot <hola@chambeabot.com>"` is set on both.
- Verified live: `POST /auth/password` triggers a job that hits Resend and
  gets back `401 {"message":"API key is invalid"}` — exactly the expected
  response for our placeholder key. Swap the key and emails will fly.

## What David needs to do (10 min total)

### 1. Create a Resend account (2 min)

- Go to https://resend.com and sign up.
- Free tier = 3,000 emails/month, 100/day. Plenty for Chambeabot's transactional load.

### 2. Verify the sending domain (5 min)

- In Resend dashboard → **Domains** → **Add Domain** → enter `chambeabot.com`.
- Resend will show 3 DNS records you need to add at your DNS provider:
  - **DKIM** (TXT): `send.resend.dev._domainkey.chambeabot.com` (value starts with `p=...`)
  - **SPF** (TXT): `chambeabot.com` (value: `v=spf1 include:amazonses.com ~all`)
  - **Return-Path** (MX or CNAME depending on Resend's spec).
- Add them. Resend checks every 30s. Should be green in 2-5 min.
- Click "Verify" once green.

### 3. Create an API key (1 min)

- Resend dashboard → **API Keys** → **Create API Key** → name "Chambeabot production".
- Permission: **Full access** (sending only — that's all it offers).
- Domain: restrict to `chambeabot.com` (recommended).
- Copy the key (starts with `re_`, ~36 chars).

### 4. Replace the placeholder in Railway (2 min)

Run from the chatwoot project dir:

```bash
railway variables set --service crm-web   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
railway variables set --service crm-worker RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

Both services will auto-redeploy. Total wait: ~3-5 min.

### 5. Test it

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"david@dglezz.com"}' \
  https://crm.chambeabot.com/auth/password
```

Then watch the worker log:

```bash
railway logs --service crm-worker | grep -i "ResendDelivery"
```

You should see `[ResendDelivery] Delivered email id=...` and the email arrives
in the inbox within 30s.

To check delivery status from the API side, in Resend dashboard → **Emails**
you'll see every send with open/click tracking.

## What goes through this path

- `Devise::Mailer#reset_password_instructions` (password resets, account confirmations)
- `ConversationReplyMailer` — NO, this uses per-channel SMTP (`conversation_reply_mailer_helper.rb` sets
  `@options[:delivery_method] = :smtp` per-message based on `@channel.smtp_enabled`). Inbox-to-customer
  replies go through Gmail/Microsoft SMTP via channel config, not Resend. That's by design.
- `Notifications::Channel` (in-app email notifications) — yes.
- Anything from `Devise` — yes.
- Inbound: still uses `Channel::Email` inbox (the `support@chambeabot.com` inbox, captured by
  the Cloudflare Email Worker → `POST /rails/action_mailbox/relay/inbound_emails`).

## Fallback

If Resend ever has an outage, flip back to SMTP by removing the env var:

```bash
railway variables unset --service crm-web   MAILER_DELIVERY_METHOD
railway variables unset --service crm-worker MAILER_DELIVERY_METHOD
```

But this only works on the Railway Pro plan. On Hobby, all SMTP ports are blocked
so the fallback would be `:sendmail` (which fails since there's no local postfix).
The Resend HTTPS path is the only working option on Hobby.

## Why HTTPS instead of SMTP-to-HTTP relay?

We considered:
- **Cloudflare Email Workers** — receive only, can't listen on SMTP for outbound.
- **Mailgun / SendGrid SMTP** — same port block, same problem.
- **SMTP-to-HTTPS relay on a separate Railway service** — extra service, extra cost, more failure modes.
- **Custom HTTPS delivery method (chosen)** — zero new infra, just Rails stdlib (`Net::HTTP`),
  no extra gem. Works on every Railway plan.

The Resend SDK exists (`resend` gem) but it adds a dep. Our hand-rolled class is ~190 lines
and handles all the same cases (attachments, cc/bcc, reply_to, X- headers, multipart).

## Cost

Resend free tier covers Chambeabot's volume easily:
- 3,000 emails/month free
- $20/mo for 50,000 emails if we exceed
- Compared to Mailgun's $35/mo Essentials, it's 60% cheaper at the 50k tier
  and free up to 3k.

## Files to know

- `lib/mail/resend_delivery.rb` — the delivery class. ~190 lines.
- `config/initializers/mailer.rb` — wires up `add_delivery_method :resend, Mail::ResendDelivery, ...`
  and sets `ActionMailer::Base.delivery_method = :resend` (not just `config.action_mailer.*`).
- `app/mailers/conversation_reply_mailer_helper.rb` — per-channel SMTP for inbox replies
  (uses `Channel::Email`'s IMAP/SMTP credentials, not Resend). Leave alone.

## Gotchas

- **Two setters, not one.** Setting only `config.action_mailer.delivery_method = :resend`
  in an initializer is silently dropped because the ActionMailer railtie runs first and
  flushes the OrderedOptions hash to `ActionMailer::Base` before any user initializers.
  We set both. This was the bug that took 30 min to find (smtp kept winning).

- **`add_delivery_method` is a class method on ActionMailer::Base**, not a config setter.
  Calling `ActionMailer::Base.add_delivery_method(:resend, Mail::ResendDelivery, ...)`
  registers the class in `ActionMailer::Base.delivery_methods[:resend]` AND creates a
  `resend_settings` class attribute. After that, `ActionMailer::Base.delivery_method = :resend`
  works because `wrap_delivery_behavior` looks up the symbol in `delivery_methods`.

- **Mail-from mismatch with `MAILER_SENDER_EMAIL`.** Resend refuses to send if the
  `from` address doesn't match the verified domain. We send from
  `Chambeabot <hola@chambeabot.com>`. Make sure Resend's verified domain is
  `chambeabot.com` (not `mail.chambeabot.com` or a subdomain) or this will fail.
