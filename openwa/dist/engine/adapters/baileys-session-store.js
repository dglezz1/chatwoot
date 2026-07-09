"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysSessionStore = void 0;
const wa_id_1 = require("../identity/wa-id");
class BaileysSessionStore {
    lidStore;
    sessionId;
    contacts = new Map();
    chats = new Map();
    lastMessages = new Map();
    lidToPn = new Map();
    ephemeralByChat = new Map();
    constructor(lidStore, sessionId) {
        this.lidStore = lidStore;
        this.sessionId = sessionId;
    }
    upsertContacts(records = []) {
        for (const r of records) {
            if (!r.id) {
                continue;
            }
            const existing = this.contacts.get(r.id) ?? { id: r.id };
            const merged = { ...existing, ...r };
            this.contacts.set(r.id, merged);
            const phone = merged.phoneNumber ?? merged.jid;
            if (merged.lid && phone) {
                this.lidToPn.set(merged.lid, phone);
                this.persistLidMapping(merged.lid, phone);
            }
        }
    }
    upsertChats(records = []) {
        for (const r of records) {
            if (!r.id) {
                continue;
            }
            const existing = this.chats.get(r.id) ?? { id: r.id };
            this.chats.set(r.id, { ...existing, ...r });
        }
    }
    addLidMappings(mappings = []) {
        for (const m of mappings) {
            if (m.lid && m.pn) {
                this.lidToPn.set(m.lid, m.pn);
                this.persistLidMapping(m.lid, m.pn);
            }
        }
    }
    recordKeyLidMappings(key) {
        this.addLidMappings([
            { lid: key.senderLid ?? undefined, pn: key.senderPn ?? undefined },
            { lid: key.participantLid ?? undefined, pn: key.participantPn ?? undefined },
        ]);
    }
    persistLidMapping(lidJid, pnJid) {
        void this.lidStore?.remember((0, wa_id_1.userPart)(lidJid), (0, wa_id_1.userPart)(pnJid), this.sessionId);
    }
    recordMessage(msg) {
        const chatId = msg.key?.remoteJid;
        if (!chatId || !msg.key) {
            return;
        }
        this.recordEphemeralFromMessage(chatId, msg);
        const timestamp = this.toUnixSeconds(msg.messageTimestamp);
        const existing = this.lastMessages.get(chatId);
        if (existing && existing.timestamp >= timestamp) {
            return;
        }
        const text = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '';
        this.lastMessages.set(chatId, { key: msg.key, timestamp, text });
    }
    recordEphemeralFromMessage(chatId, msg) {
        const duration = this.extractEphemeralDuration(msg);
        if (duration === undefined) {
            return;
        }
        this.ephemeralByChat.set(chatId, duration);
        this.ephemeralByChat.set(this.toNeutralJid(chatId), duration);
    }
    extractEphemeralDuration(msg) {
        const fromInfo = msg.ephemeralDuration;
        if (typeof fromInfo === 'number' && fromInfo > 0) {
            return fromInfo;
        }
        const fromContext = this.contextExpiration(msg.message);
        return typeof fromContext === 'number' && fromContext > 0 ? fromContext : undefined;
    }
    contextExpiration(content, depth = 0) {
        if (!content || typeof content !== 'object' || depth > 4) {
            return undefined;
        }
        const nodes = content;
        for (const node of Object.values(nodes)) {
            const exp = node?.contextInfo?.expiration;
            if (typeof exp === 'number' && exp > 0) {
                return exp;
            }
            if (node?.message) {
                const nested = this.contextExpiration(node.message, depth + 1);
                if (nested !== undefined) {
                    return nested;
                }
            }
        }
        return undefined;
    }
    listContacts() {
        return [...this.contacts.values()].map(c => this.toNeutralContact(c));
    }
    findContact(id) {
        const c = this.contacts.get(id) ?? this.contacts.get(this.toEngineJid(id));
        return c ? this.toNeutralContact(c) : null;
    }
    listChats() {
        return [...this.chats.values()].map(c => this.toNeutralChat(c));
    }
    lastMessage(chatId) {
        const m = this.lastMessages.get(chatId) ?? this.lastMessages.get(this.toEngineJid(chatId));
        return m ? { key: m.key, timestamp: m.timestamp } : null;
    }
    getEphemeralExpiration(chatId) {
        const fromMessage = this.ephemeralByChat.get(chatId) ??
            this.ephemeralByChat.get(this.toEngineJid(chatId)) ??
            this.ephemeralByChat.get(this.toNeutralJid(chatId));
        if (typeof fromMessage === 'number' && fromMessage > 0) {
            return fromMessage;
        }
        const chat = this.chats.get(chatId) ?? this.chats.get(this.toEngineJid(chatId)) ?? this.chats.get(this.toNeutralJid(chatId));
        const exp = chat?.ephemeralExpiration;
        return typeof exp === 'number' && exp > 0 ? exp : undefined;
    }
    resolvePhone(id) {
        const parsed = (0, wa_id_1.parseWaId)(id);
        if (parsed.kind === 'user') {
            return parsed.userPart;
        }
        if (parsed.kind === 'lid') {
            const lidJid = `${parsed.userPart}@lid`;
            const pn = this.lidToPn.get(lidJid) ?? this.lidToPn.get(id);
            if (pn) {
                return (0, wa_id_1.userPart)(pn);
            }
            const contactPhone = (this.contacts.get(lidJid) ?? this.contacts.get(id))?.phoneNumber;
            if (contactPhone) {
                return (0, wa_id_1.userPart)(contactPhone);
            }
            return this.lidStore?.getCached(parsed.userPart) ?? null;
        }
        return null;
    }
    toNeutralJid(jid) {
        return (0, wa_id_1.toNeutralJid)(jid, id => this.resolvePhone(id));
    }
    toEngineJid(jid) {
        const parsed = (0, wa_id_1.parseWaId)(jid);
        return parsed.kind === 'user' ? `${parsed.userPart}@s.whatsapp.net` : jid;
    }
    toNeutralContact(c) {
        const number = c.phoneNumber ? (0, wa_id_1.userPart)(c.phoneNumber) : c.id.endsWith('@s.whatsapp.net') ? (0, wa_id_1.userPart)(c.id) : '';
        return {
            id: this.toNeutralJid(c.id),
            name: c.name ?? c.verifiedName,
            pushName: c.notify,
            number,
            isMyContact: true,
            isBlocked: false,
            profilePicUrl: c.imgUrl ?? undefined,
        };
    }
    toNeutralChat(c) {
        const last = this.lastMessages.get(c.id);
        return {
            id: this.toNeutralJid(c.id),
            name: c.name ?? this.resolveContactName(c.id),
            isGroup: c.id.endsWith('@g.us'),
            unreadCount: c.unreadCount ?? 0,
            timestamp: last?.timestamp ?? this.toUnixSeconds(c.conversationTimestamp),
            lastMessage: last?.text,
        };
    }
    resolveContactName(id) {
        const direct = this.contactDisplayName(id);
        if (direct) {
            return direct;
        }
        const parsed = (0, wa_id_1.parseWaId)(id);
        if (parsed.kind === 'lid') {
            const lidJid = `${parsed.userPart}@lid`;
            const pn = this.lidToPn.get(lidJid) ??
                this.lidToPn.get(id) ??
                (this.contacts.get(lidJid) ?? this.contacts.get(id))?.phoneNumber;
            if (pn) {
                const viaPhone = this.contactDisplayName(pn) ??
                    this.contactDisplayName(`${(0, wa_id_1.userPart)(pn)}@s.whatsapp.net`) ??
                    this.contactDisplayName(`${(0, wa_id_1.userPart)(pn)}@c.us`);
                if (viaPhone) {
                    return viaPhone;
                }
            }
        }
        return (0, wa_id_1.userPart)(id);
    }
    contactDisplayName(id) {
        const c = this.contacts.get(id);
        return c ? (c.name ?? c.verifiedName ?? c.notify ?? undefined) : undefined;
    }
    toUnixSeconds(ts) {
        if (ts == null) {
            return 0;
        }
        return typeof ts === 'number' ? ts : ts.toNumber();
    }
}
exports.BaileysSessionStore = BaileysSessionStore;
//# sourceMappingURL=baileys-session-store.js.map