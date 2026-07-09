"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBaileysGroup = mapBaileysGroup;
exports.mapBaileysGroupInfo = mapBaileysGroupInfo;
const wa_id_1 = require("../identity/wa-id");
const identity = jid => jid;
function isSelfAdmin(metadata, selfJid, normalizeJid) {
    const self = (0, wa_id_1.userPart)(normalizeJid(selfJid));
    return metadata.participants.some(p => (0, wa_id_1.userPart)(normalizeJid(p.id)) === self && (p.admin === 'admin' || p.admin === 'superadmin'));
}
function mapBaileysGroup(metadata, selfJid, normalizeJid = identity) {
    return {
        id: metadata.id,
        name: metadata.subject,
        participantsCount: metadata.participants.length,
        isAdmin: isSelfAdmin(metadata, selfJid, normalizeJid),
        linkedParentJID: metadata.linkedParent ?? null,
    };
}
function mapBaileysGroupInfo(metadata, normalizeJid = identity) {
    const participants = metadata.participants.map(p => {
        const id = normalizeJid(p.id);
        return {
            id,
            number: (0, wa_id_1.userPart)(id),
            name: p.name,
            isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
            isSuperAdmin: p.admin === 'superadmin',
        };
    });
    return {
        id: metadata.id,
        name: metadata.subject,
        description: metadata.desc,
        owner: metadata.owner ? normalizeJid(metadata.owner) : metadata.owner,
        createdAt: metadata.creation,
        participants,
        isAnnounce: metadata.announce,
        isReadOnly: metadata.announce,
        linkedParentJID: metadata.linkedParent ?? null,
    };
}
//# sourceMappingURL=baileys-group-mapper.js.map