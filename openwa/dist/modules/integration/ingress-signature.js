"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIngressSignature = verifyIngressSignature;
exports.safeEqualStr = safeEqualStr;
const node_crypto_1 = require("node:crypto");
function header(headers, name) {
    if (!name)
        return undefined;
    return headers[name.toLowerCase()];
}
function verifyIngressSignature(spec, input) {
    if (spec.scheme === 'none')
        return { ok: true };
    if (!input.secret)
        return { ok: false, reason: 'empty ingress secret' };
    if (spec.timestampHeader) {
        const tsRaw = header(input.headers, spec.timestampHeader);
        const ts = Number.parseInt(tsRaw ?? '', 10);
        if (!Number.isFinite(ts))
            return { ok: false, reason: 'missing/invalid timestamp' };
        const skewSec = Math.abs(input.now / 1000 - ts);
        if (!(spec.toleranceSec && skewSec <= spec.toleranceSec)) {
            return { ok: false, reason: 'replay: timestamp outside tolerance' };
        }
    }
    const provided = header(input.headers, spec.header);
    if (!provided)
        return { ok: false, reason: 'missing signature header' };
    if (spec.scheme === 'shared-secret') {
        return safeEqualStr(provided, input.secret) ? { ok: true } : { ok: false, reason: 'shared-secret mismatch' };
    }
    const template = spec.contentTemplate ?? '{rawBody}';
    const timestamp = header(input.headers, spec.timestampHeader) ?? '';
    const signedContent = template.replace(/\{rawBody\}|\{timestamp\}/g, token => token === '{rawBody}' ? input.rawBody : timestamp);
    const digest = (0, node_crypto_1.createHmac)('sha256', input.secret)
        .update(signedContent)
        .digest(spec.encoding ?? 'hex');
    const expected = (spec.prefix ?? '') + digest;
    return safeEqualStr(provided, expected) ? { ok: true } : { ok: false, reason: 'hmac mismatch' };
}
function safeEqualStr(a, b) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(ba, bb);
}
//# sourceMappingURL=ingress-signature.js.map