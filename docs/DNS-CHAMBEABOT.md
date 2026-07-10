# DNS records needed for chambeabot.com

Apply these at your DNS provider (Cloudflare / Namecheap / GoDaddy / etc.):

| Type | Host | Value | Purpose |
|------|------|-------|---------|
| CNAME | `chambeabot.com` | `sp5n1jh9.up.railway.app` | Landing page (chambeabot.com → crm-landing) |
| CNAME | `www` | `ip8a5z2s.up.railway.app` | Landing www → crm-landing |
| CNAME | `crm` | (use the value shown in Railway dashboard for the crm-web service) | CRM dashboard |

**How to find the crm-web CNAME value:**
1. Go to https://railway.app/project/eb203d7e-612f-49e5-b42e-ebfa2c8e305f/service/d7e4e45c-0d68-471e-8cfd-82a52b817ea3
2. Settings → Domains → crm.chambeabot.com → copy the "DNS" CNAME value
3. Use that value in your DNS provider for the `crm` CNAME

**After adding the records**, Railway will issue a Let's Encrypt certificate
automatically (1-5 minutes). The site at `https://chambeabot.com` will then load
the Chambeabot landing page, `https://crm.chambeabot.com` will load the
Chatwoot dashboard.

**Subdomain routing:**
- `https://chambeabot.com` → static landing (this PR)
- `https://www.chambeabot.com` → static landing
- `https://crm.chambeabot.com` → Chatwoot CRM
