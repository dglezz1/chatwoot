# Chambeabot → Brevo Migration (5 min, gratis)

## TL;DR

Brevo (ex-Sendinblue) es el proveedor recomendado para Chambeabot:
- **300 emails/día gratis** = 9,000/mes (3x más que Resend)
- **Dominios ilimitados** en el plan free (Resend solo deja 1)
- **Sin tarjeta de crédito**
- Mismo patrón HTTPS (port 443) que Resend — funciona en todos los planes de Railway

Ya está el código `Mail::BrevoDelivery` desplegado. Solo falta la API key y verificar el dominio.

## Lo que ya está hecho (no tocar)

- `lib/mail/brevo_delivery.rb` — clase de delivery HTTPS para Brevo (178 líneas)
- `config/initializers/mailer.rb` — registra `:brevo` y `:resend` como métodos
- `Mail::ResendDelivery` sigue disponible como fallback

## Lo que David debe hacer (~5 min)

### 1. Crear cuenta en Brevo (1 min)

- https://www.brevo.com → Sign up (email o Google).
- **No pide tarjeta.**
- Free tier = 300 emails/día, dominios ilimitados, sin expiry.

### 2. Verificar `chambeabot.com` (2 min)

- Dashboard → Settings → Senders & Domains → **Add a domain** → `chambeabot.com`.
- Brevo te muestra 2 records DNS a agregar en Cloudflare:
  - **DKIM** (TXT): `mail._domainkey.chambeabot.com` → `k=rsa; p=MIGf...`
  - **Return-Path** (CNAME): `bounces.chambeabot.com` → `feedback-smtp.brevo.com` (o similar)
- Agrégalos en Cloudflare con proxy **DNS only** (nube gris, NO proxy).
- Click **Verify** en Brevo. Tarda 2-5 min en checar.

### 3. Crear API key (1 min)

- Brevo → Settings → SMTP & API → **API Keys** → **Generate a new API key**.
- Nombre: `chambeabot-prod`. Permiso: **All** (or restrict to transactional).
- Copia la key (formato `xkeysib-...`).

### 4. Pegar la key en Railway (1 min)

```bash
cd ~/Developer/chatwoot
railway variables set --service crm-web   \
  MAILER_DELIVERY_METHOD=brevo \
  BREVO_API_KEY=xkeysib-xxxxxxxxxxxx

railway variables set --service crm-worker \
  MAILER_DELIVERY_METHOD=brevo \
  BREVO_API_KEY=xkeysib-xxxxxxxxxxxx

# Opcional: remover la de Resend (ya no la usamos)
railway variables unset --service crm-web   MAILER_DELIVERY_METHOD
railway variables unset --service crm-web   RESEND_API_KEY
railway variables unset --service crm-worker MAILER_DELIVERY_METHOD
railway variables unset --service crm-worker RESEND_API_KEY
```

Railway redespliega ambos servicios en 3-5 min.

### 5. Probar

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"david@dglezz.com"}' \
  https://crm.chambeabot.com/auth/password
```

Verifica los logs:
```bash
railway logs --service crm-worker | grep BrevoDelivery
```

Deberías ver `[BrevoDelivery] Delivered email messageId=...`. Y el email llega a tu inbox en <30s.

Para chequear deliverability desde Brevo: dashboard → Transactional → Emails (muestra opens/clicks/bounces).

## Estructura del API de Brevo (vs Resend)

| | Resend | Brevo |
|---|---|---|
| Endpoint | `POST /emails` | `POST /v3/smtp/email` |
| Auth | `Authorization: Bearer re_xxx` | `api-key: xkeysib-xxx` |
| From | `"Name <a@b.com>"` string | `{ email, name }` object |
| To | array of strings | array of `{email, name}` |
| Cc/Bcc | array of strings | array of `{email, name}` |
| ReplyTo | array of strings | single `{email, name}` object |
| HTML | `html:` key | `htmlContent:` key |
| Text | `text:` key | `textContent:` key |
| Attachments | `[{filename, content (b64)}]` | `[{name, content (b64)}]` |

Ambas librerías son hand-rolled en el repo, no usamos el SDK oficial.

## Variables de entorno finales

```bash
# crm-web + crm-worker
MAILER_DELIVERY_METHOD=brevo
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx
BREVO_API_BASE=https://api.brevo.com
MAILER_SENDER_EMAIL="Chambeabot <hola@chambeabot.com>"
MAILER_INBOUND_EMAIL_DOMAIN=chambeabot.com
FRONTEND_URL=https://crm.chambeabot.com
RAILS_INBOUND_EMAIL_SERVICE=relay

# Ya no se usan
# MAILER_DELIVERY_METHOD=resend
# RESEND_API_KEY=re_xxx
# RESEND_API_BASE=https://api.resend.com
```

## Qué pasa si Brevo se cae

```bash
railway variables set --service crm-web   MAILER_DELIVERY_METHOD=resend
railway variables set --service crm-worker MAILER_DELIVERY_METHOD=resend
# Asegúrate de tener RESEND_API_KEY todavía en env
```

Si tampoco Resend, vuelve a SMTP (requiere Pro plan de Railway):
```bash
railway variables set --service crm-web   MAILER_DELIVERY_METHOD=smtp SMTP_ADDRESS=...
```

## Costos

- **0-9,000 emails/mes:** $0
- **9,000-20,000 emails/mes:** ~$9/mes
- **20,000-100,000 emails/mes:** ~$25-$65/mes

## Por qué no Resend (elección original)

| Criterio | Resend | Brevo |
|---|---|---|
| Free tier | 3,000/mes | **9,000/mes** |
| Dominios en free | 1 | **Ilimitados** |
| Card required | No | No |
| Setup | 5 min | 5 min |
| Footer obligatorio | No | **"via Brevo"** (irrelevante para transaccional) |
| API calidad | Excelente | Muy buena (más verbosa que Resend) |
| Deliverability | Buena | **Mejor** (red europea madura) |

Footer "via Brevo" no es problema para mail transaccional (password reset, confirmaciones) — los usuarios lo ignoran. Si llega a molestar, el plan paid ($9/mes) lo quita.

## Por qué NO self-hosted (Mailcow/Stalwart/Postal)

Decidimos en la sesión del 2026-07-10 que self-hosting desde el server casero (`Dropabyte` en Tailscale 100.70.114.24) no funciona porque:

1. **Telmex Infinitum bloquea puerto 25 saliente** en IPs residenciales (probado con `nc smtp.gmail.com 25` desde el server → timeout).
2. **IP residencial `187.234.241.20` está en listas negras** (todas las de Telmex lo están).
3. **rDNS apunta a `prod-infinitum.com.mx`** — no se puede cambiar, Gmail marca como spam.
4. **Railway Hobby también bloquea SMTP** — incluso el server en la nube con Tailscale terminaría pasando por Railway egress, mismo bloqueo.

Si en el futuro quieres self-hosting real: Hetzner CX22 ($4.5/mes, datacenter en Alemania, port 25 abierto, IP estática con rDNS configurable). Te dejo la lista en `docs/SELF-HOSTING-OPTIONS.md` para cuando llegue ese momento.

## Memoria para el futuro

Decisión: **Brevo como proveedor de email transaccional para Chambeabot**, código en `lib/mail/brevo_delivery.rb`. Resend queda como fallback. Self-hosting descartado por ISP/rDNS/IP reputation.
