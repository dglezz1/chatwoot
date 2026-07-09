"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIdempotencyKey = generateIdempotencyKey;
exports.generateDeliveryId = generateDeliveryId;
const crypto_1 = require("crypto");
function toStr(value, fallback = 'unknown') {
    if (value === null || value === undefined)
        return fallback;
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return fallback;
}
function hashData(data) {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return (0, crypto_1.createHash)('sha256').update(str).digest('hex').substring(0, 12);
}
function generateIdempotencyKey(event, data, occurredAt) {
    const occurrence = occurredAt ? `_${occurredAt}` : '';
    switch (event) {
        case 'message.received':
        case 'message.sent':
            return `msg_${toStr(data.sessionId)}_${toStr(data.id ?? data.messageId)}`;
        case 'message.ack':
            return `ack_${toStr(data.sessionId)}_${toStr(data.id ?? data.messageId)}_${toStr(data.status ?? data.ack, '0')}`;
        case 'message.failed':
            return `failed_${toStr(data.sessionId)}_${toStr(data.id ?? data.messageId)}_${toStr(data.status ?? data.ack, '0')}`;
        case 'message.revoked':
            return `rev_${toStr(data.sessionId)}_${toStr(data.id ?? data.messageId)}`;
        case 'message.reaction':
            return `react_${toStr(data.sessionId)}_${toStr(data.messageId)}_${toStr(data.senderId)}${occurrence}`;
        case 'session.status':
            return `sess_${toStr(data.sessionId)}_${toStr(data.status)}${occurrence}`;
        case 'session.qr':
            return `qr_${toStr(data.sessionId)}_${hashData({ qr: data.qr })}`;
        case 'session.authenticated':
            return `auth_${toStr(data.sessionId)}_${hashData(data)}${occurrence}`;
        case 'session.disconnected':
            return `disc_${toStr(data.sessionId)}_${hashData({ reason: data.reason })}${occurrence}`;
        case 'group.join':
            return `grp_${toStr(data.groupId)}_${toStr(data.participantId)}_join`;
        case 'group.leave':
            return `grp_${toStr(data.groupId)}_${toStr(data.participantId)}_leave`;
        case 'group.update':
            return `grp_${toStr(data.groupId)}_update_${hashData(data)}`;
        default:
            return `evt_${event.replace(/\./g, '_')}_${hashData(data)}`;
    }
}
function generateDeliveryId() {
    return `dlv_${(0, crypto_1.randomUUID)()}`;
}
//# sourceMappingURL=idempotency.util.js.map