"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPart = userPart;
exports.parseWaId = parseWaId;
exports.toNeutralJid = toNeutralJid;
exports.isChannelJid = isChannelJid;
const USER_DOMAINS = new Set(['c.us', 's.whatsapp.net']);
function userPart(jid) {
    return jid.split('@')[0].split(':')[0];
}
function parseWaId(jid) {
    const raw = jid;
    const lower = jid.trim().toLowerCase();
    if (lower === 'status@broadcast') {
        return { kind: 'status', userPart: 'status', raw };
    }
    const at = lower.lastIndexOf('@');
    if (at === -1) {
        return { kind: 'unknown', userPart: lower, raw };
    }
    const domain = lower.slice(at + 1);
    const [local, device] = lower.slice(0, at).split(':');
    const kind = USER_DOMAINS.has(domain)
        ? 'user'
        : domain === 'g.us'
            ? 'group'
            : domain === 'lid'
                ? 'lid'
                : domain === 'newsletter'
                    ? 'newsletter'
                    : domain === 'broadcast'
                        ? 'broadcast'
                        : 'unknown';
    return { kind, userPart: local, device, raw };
}
function toNeutralJid(jid, resolvePhone) {
    if (!jid) {
        return jid;
    }
    const parsed = parseWaId(jid);
    switch (parsed.kind) {
        case 'user':
            return `${parsed.userPart}@c.us`;
        case 'group':
            return `${parsed.userPart}@g.us`;
        case 'lid': {
            const phone = resolvePhone?.(jid);
            return phone ? `${phone}@c.us` : `${parsed.userPart}@lid`;
        }
        case 'status':
            return 'status@broadcast';
        case 'newsletter':
            return `${parsed.userPart}@newsletter`;
        case 'broadcast':
            return `${parsed.userPart}@broadcast`;
        default:
            return jid;
    }
}
function isChannelJid(jid) {
    return parseWaId(jid).kind === 'newsletter';
}
//# sourceMappingURL=wa-id.js.map