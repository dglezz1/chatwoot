/**
 * Cloudflare Email Worker for Chambeabot
 * ----------------------------------------
 *
 * Receives inbound email via Cloudflare Email Routing → Cloudflare Email Workers
 * and forwards the raw RFC822 message to Chatwoot's ActionMailbox relay
 * endpoint at /rails/action_mailbox/relay/inbound_emails. The Message-ID
 * header is preserved so Chatwoot can dedupe across retries.
 *
 * Auth: we use a static bearer token (CHATWOOT_EMAIL_BRIDGE_TOKEN) set as a
 * Worker secret. Chatwoot's relay endpoint accepts the token via
 * `Authorization: Bearer <token>` (chatwoot's ActionMailbox doesn't validate
 * the header today, but we send it for future-proofing).
 *
 * Deploy:
 *   1. wrangler login
 *   2. cd cloudflare-workers/email-relay
 *   3. wrangler deploy
 *   4. wrangler secret put CHATWOOT_RELAY_URL
 *      # → https://crm.chambeabot.com/rails/action_mailbox/relay/inbound_emails
 *   5. wrangler secret put CHATWOOT_EMAIL_BRIDGE_TOKEN
 *      # → any long random string
 *
 * Bind the Worker to your Email Routing rule:
 *   Cloudflare dashboard → Email → Email Routing → Routes → "Catch-all"
 *   Action: "Send to a Worker" → pick "chambeabot-email-relay"
 *   (Optional: scope it to a specific address, e.g. support@chambeabot.com)
 *
 * That's it. Inbound mail to anything@chambeabot.com (or the bound address)
 * will land in the matching Channel::Email inbox in the Chatwoot dashboard.
 */

// @ts-check
export default {
  /**
   * Cloudflare Email Workers entry point. The `email` parameter is a
   * ForwardableEmailMessage containing the raw RFC822 payload + metadata.
   * @param {ForwardableEmailMessage} email
   * @param {Env} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<void>}
   */
  async email(email, env, ctx) {
    const { from, to, raw, rawSize, messageId, subject } = email;

    // 1. The raw message body is a ReadableStream — read it all into a
    //    single Uint8Array that we can hand to fetch as a body.
    const bodyBytes = await readAll(raw);

    // 2. Forward to Chatwoot's ActionMailbox relay endpoint.
    const targetUrl = env.CHATWOOT_RELAY_URL;
    if (!targetUrl) {
      console.error("CHATWOOT_RELAY_URL is not configured");
      // Returning without throwing — let Cloudflare retry later if the
      // routing rule is set to retry. The "missing config" path is also
      // logged so we can see it in the Worker logs.
      return;
    }

    const headers = new Headers({
      "Content-Type": "message/rfc822",
      "X-Original-From": from,
      "X-Original-To": to,
      "X-Original-Message-Id": messageId || "",
      "X-Original-Subject": subject || "",
      "X-Forwarded-By": "cloudflare-email-relay/1.0",
    });
    if (env.CHATWOOT_EMAIL_BRIDGE_TOKEN) {
      headers.set("Authorization", `Bearer ${env.CHATWOOT_EMAIL_BRIDGE_TOKEN}`);
    }

    let response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: bodyBytes,
      });
    } catch (err) {
      console.error(`bridge fetch failed: ${err}`);
      // Throw so Cloudflare retries the email — better to deliver twice than
      // to drop. Chatwoot's ActionMailbox dedupes by Message-ID header.
      throw err;
    }

    if (!response.ok) {
      const txt = await response.text().catch(() => "<unreadable>");
      console.error(
        `bridge returned ${response.status}: ${txt.slice(0, 500)}`
      );
      // 4xx means the request is malformed and retrying won't help; let it
      // bounce. 5xx is transient — throw to retry.
      if (response.status >= 500) {
        throw new Error(`chatwoot relay 5xx: ${response.status}`);
      }
    } else {
      console.log(
        `bridged ${messageId || "<no-id>"} ${from} → ${to} (${rawSize}B)`
      );
    }
  },
};

/**
 * Read a ReadableStream to its end and return a Uint8Array.
 * Cloudflare Email Workers passes a ReadableStream in the `raw` field.
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {Promise<Uint8Array>}
 */
async function readAll(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
