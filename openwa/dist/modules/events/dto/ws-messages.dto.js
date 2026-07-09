"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIBABLE_EVENTS = void 0;
exports.buildRoomName = buildRoomName;
exports.parseRoomName = parseRoomName;
exports.SUBSCRIBABLE_EVENTS = [
    'message.received',
    'message.sent',
    'message.ack',
    'message.revoked',
    'message.reaction',
    'session.status',
    'session.qr',
    'session.authenticated',
    'session.disconnected',
];
function buildRoomName(sessionId, event) {
    return `session:${sessionId}:${event}`;
}
function parseRoomName(room) {
    const match = room.match(/^session:([^:]+):(.+)$/);
    if (!match)
        return null;
    return { sessionId: match[1], event: match[2] };
}
//# sourceMappingURL=ws-messages.dto.js.map