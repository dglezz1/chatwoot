"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysAdapter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const qrcode = __importStar(require("qrcode"));
const baileys_message_mapper_1 = require("./baileys-message-mapper");
const baileys_group_mapper_1 = require("./baileys-group-mapper");
const whatsapp_engine_interface_1 = require("../interfaces/whatsapp-engine.interface");
const load_remote_media_1 = require("../../common/media/load-remote-media");
const engine_not_ready_error_1 = require("../../common/errors/engine-not-ready.error");
const engine_not_supported_error_1 = require("../../common/errors/engine-not-supported.error");
const message_not_found_error_1 = require("../../common/errors/message-not-found.error");
const logger_service_1 = require("../../common/services/logger.service");
const baileys_session_store_1 = require("./baileys-session-store");
const vcard_1 = require("./vcard");
const inbound_media_cap_1 = require("./inbound-media-cap");
const concurrency_limiter_1 = require("./concurrency-limiter");
const BAILEYS_BROWSER = ['OpenWA', 'Chrome', '120.0.0'];
function createSilentLogger() {
    const noop = () => { };
    const logger = {
        level: 'silent',
        child: () => logger,
        trace: noop,
        debug: noop,
        info: noop,
        warn: noop,
        error: noop,
    };
    return logger;
}
const BAILEYS_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'];
function createBaileysLogger() {
    const configured = (process.env.BAILEYS_LOG_LEVEL ?? 'silent').toLowerCase();
    if (!BAILEYS_LOG_LEVELS.includes(configured)) {
        return createSilentLogger();
    }
    const threshold = BAILEYS_LOG_LEVELS.indexOf(configured);
    const write = (lvl) => (obj, msg) => {
        if (BAILEYS_LOG_LEVELS.indexOf(lvl) < threshold) {
            return;
        }
        const rec = typeof obj === 'string' ? { msg: obj } : { ...obj, ...(msg ? { msg } : {}) };
        process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: lvl, context: 'baileys-wire', ...rec }) + '\n');
    };
    const logger = {
        level: configured,
        child: () => logger,
        trace: write('trace'),
        debug: write('debug'),
        info: write('info'),
        warn: write('warn'),
        error: write('error'),
    };
    return logger;
}
class BaileysAdapter {
    config;
    static MAX_RECONNECT_ATTEMPTS = 5;
    logger = (0, logger_service_1.createLogger)('BaileysAdapter');
    inboundLimiter = new concurrency_limiter_1.ConcurrencyLimiter((0, inbound_media_cap_1.inboundMediaConcurrency)());
    authPath;
    sessionStore;
    sock = null;
    status = whatsapp_engine_interface_1.EngineStatus.DISCONNECTED;
    qrCode = null;
    phoneNumber = null;
    pushName = null;
    callbacks = {};
    intentionalClose = false;
    connecting = false;
    reconnectAttempts = 0;
    reconnectTimer;
    lib;
    async loadLib() {
        return (this.lib ??= await import('@whiskeysockets/baileys'));
    }
    constructor(config) {
        this.config = config;
        this.authPath = path.join(config.authDir, config.sessionId);
        this.sessionStore = new baileys_session_store_1.BaileysSessionStore(config.lidMappingStore, config.sessionId);
        if (config.proxyUrl) {
            this.logger.warn('Proxy configured but not supported by the baileys engine in this slice; ignoring it', {
                action: 'baileys_proxy_unsupported',
                sessionId: config.sessionId,
            });
        }
    }
    async initialize(callbacks) {
        this.callbacks = callbacks;
        this.intentionalClose = false;
        try {
            await this.connect();
        }
        catch (err) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            this.callbacks.onError?.(err instanceof Error ? err.message : String(err));
            throw err;
        }
    }
    async connect() {
        if (this.connecting) {
            return;
        }
        this.connecting = true;
        try {
            await this.connectInner();
        }
        finally {
            this.connecting = false;
        }
    }
    async connectInner() {
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
        const b = await this.loadLib();
        const { state, saveCreds } = await b.useMultiFileAuthState(this.authPath);
        const { version } = await b.fetchLatestBaileysVersion();
        if (this.intentionalClose) {
            return;
        }
        const previous = this.sock;
        if (previous) {
            try {
                previous.ev.removeAllListeners('connection.update');
                previous.ev.removeAllListeners('creds.update');
                previous.ev.removeAllListeners('messages.upsert');
                previous.ev.removeAllListeners('messages.update');
                previous.ev.removeAllListeners('contacts.upsert');
                previous.ev.removeAllListeners('contacts.update');
                previous.ev.removeAllListeners('chats.upsert');
                previous.ev.removeAllListeners('chats.update');
                previous.ev.removeAllListeners('messaging-history.set');
                previous.ev.removeAllListeners('chats.phoneNumberShare');
                previous.end(undefined);
            }
            catch {
            }
        }
        const sock = b.default({
            auth: state,
            version,
            browser: BAILEYS_BROWSER,
            printQRInTerminal: false,
            shouldSyncHistoryMessage: () => true,
            syncFullHistory: process.env.BAILEYS_SYNC_FULL_HISTORY === 'true',
            logger: createBaileysLogger(),
        });
        this.sock = sock;
        sock.ev.on('creds.update', () => void saveCreds());
        sock.ev.on('connection.update', update => this.handleConnectionUpdate(update));
        sock.ev.on('messages.upsert', event => this.handleMessagesUpsert(event));
        sock.ev.on('messages.update', updates => this.handleMessagesUpdate(updates));
        sock.ev.on('contacts.upsert', contacts => {
            this.logContactEvent('contacts.upsert', contacts);
            this.sessionStore.upsertContacts(contacts);
        });
        sock.ev.on('contacts.update', updates => {
            this.logContactEvent('contacts.update', updates);
            this.sessionStore.upsertContacts(updates);
        });
        sock.ev.on('chats.upsert', chats => {
            this.logger.debug('Baileys chats event', { action: 'baileys_chats', event: 'upsert', count: chats?.length ?? 0 });
            this.sessionStore.upsertChats(chats);
        });
        sock.ev.on('chats.update', updates => {
            this.logger.debug('Baileys chats event', {
                action: 'baileys_chats',
                event: 'update',
                count: updates?.length ?? 0,
            });
            this.sessionStore.upsertChats(updates);
        });
        sock.ev.on('messaging-history.set', history => {
            this.sessionStore.upsertContacts(history.contacts);
            this.sessionStore.upsertChats(history.chats);
            const h = history;
            const lidPnMappings = h.lidPnMappings;
            this.sessionStore.addLidMappings(lidPnMappings ?? []);
            void this.captureHistoryMessages(history.messages ?? []);
            this.logger.debug('History sync received', {
                action: 'baileys_history_set',
                sessionId: this.config.sessionId,
                syncType: h.syncType,
                isLatest: history.isLatest,
                progress: history.progress,
                chats: history.chats?.length ?? 0,
                messages: history.messages?.length ?? 0,
                contacts: history.contacts?.length ?? 0,
                namedContacts: history.contacts?.filter(c => c.name || c.notify).length ?? 0,
                lidContacts: history.contacts?.filter(c => c.lid).length ?? 0,
                lidPnMappings: lidPnMappings?.length ?? 0,
            });
        });
        sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => this.sessionStore.addLidMappings([{ lid, pn: jid }]));
    }
    handleConnectionUpdate(update) {
        const { connection, qr, lastDisconnect } = update;
        if (qr) {
            void this.handleQrCode(qr);
        }
        if (connection === 'connecting') {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
        }
        if (connection === 'open') {
            this.qrCode = null;
            this.phoneNumber = this.extractPhone(this.sock?.user?.id);
            this.pushName = this.sock?.user?.name ?? null;
            this.reconnectAttempts = 0;
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.READY);
            this.callbacks.onReady?.(this.phoneNumber ?? '', this.pushName ?? '');
            void this.hydrateNames();
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output
                ?.statusCode;
            if (this.intentionalClose) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
                return;
            }
            if (statusCode === this.lib?.DisconnectReason.loggedOut) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
                this.sock = null;
                void this.clearAuthState();
                this.callbacks.onDisconnected?.('logged out');
                return;
            }
            this.logger.log('Baileys connection dropped; reconnecting', { statusCode });
            if (this.reconnectAttempts >= BaileysAdapter.MAX_RECONNECT_ATTEMPTS) {
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
                this.callbacks.onError?.(`reconnect attempts exhausted (${this.reconnectAttempts})`);
                return;
            }
            this.reconnectAttempts += 1;
            const delay = Math.min(30_000, 1_000 * 2 ** (this.reconnectAttempts - 1));
            if (this.reconnectTimer) {
                return;
            }
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = undefined;
                if (this.intentionalClose) {
                    return;
                }
                void this.connect().catch(err => {
                    this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
                    this.callbacks.onError?.(err instanceof Error ? err.message : String(err));
                });
            }, delay);
        }
    }
    async handleQrCode(qr) {
        try {
            this.qrCode = await qrcode.toDataURL(qr);
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.QR_READY);
            this.callbacks.onQRCode?.(this.qrCode);
        }
        catch (error) {
            this.logger.error('Error generating QR code', String(error));
        }
    }
    disconnect() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.sock?.end(undefined);
        this.sock = null;
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        return Promise.resolve();
    }
    async logout() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        try {
            await this.sock?.logout();
        }
        catch (err) {
            this.logger.warn('Baileys logout failed; ending socket', {
                error: err instanceof Error ? err.message : String(err),
            });
            this.sock?.end(undefined);
        }
        this.sock = null;
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        await this.config.messageStore?.clearSession(this.config.sessionId).catch(() => undefined);
        await this.clearAuthState();
    }
    async clearAuthState() {
        try {
            await fs.promises.rm(this.authPath, { recursive: true, force: true });
            this.logger.log('Cleared Baileys auth state', { authPath: this.authPath });
        }
        catch (err) {
            this.logger.warn('Failed to clear Baileys auth state', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    destroy() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.sock?.end(undefined);
        this.sock = null;
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        return Promise.resolve();
    }
    forceDestroy() {
        return this.destroy();
    }
    getStatus() {
        return this.status;
    }
    getQRCode() {
        return this.qrCode;
    }
    async requestPairingCode(phoneNumber) {
        if (!this.sock) {
            throw new engine_not_ready_error_1.EngineNotReadyError('Cannot request a pairing code before the engine is initialized.');
        }
        return this.sock.requestPairingCode(phoneNumber);
    }
    getPhoneNumber() {
        return this.phoneNumber;
    }
    getPushName() {
        return this.pushName;
    }
    async sendTextMessage(chatId, text, mentions) {
        this.ensureReady();
        const options = this.withEphemeral(chatId);
        const content = { text, ...this.withMentions(mentions) };
        const sent = options
            ? await this.sock.sendMessage(chatId, content, options)
            : await this.sock.sendMessage(chatId, content);
        if (sent) {
            void this.config.messageStore?.put(this.config.sessionId, sent).catch(err => this.logger.warn('Failed to persist sent message to store', {
                error: err instanceof Error ? err.message : String(err),
            }));
            void this.emitOwnSendEcho(sent);
        }
        return {
            id: sent?.key?.id ?? '',
            timestamp: this.toUnixSeconds(sent?.messageTimestamp),
        };
    }
    async checkNumberExists(number) {
        return (await this.getNumberId(number)) !== null;
    }
    async getNumberId(number) {
        this.ensureReady();
        const results = await this.sock.onWhatsApp(number);
        const hit = results?.[0];
        return hit?.exists ? this.sessionStore.toNeutralJid(hit.jid) : null;
    }
    async sendChatState(chatId, state) {
        this.ensureReady();
        const presence = state === 'typing' ? 'composing' : state === 'recording' ? 'recording' : 'paused';
        try {
            await this.sock.sendPresenceUpdate(presence, chatId);
        }
        catch (error) {
            this.logger.warn(`Could not set chat state '${state}' for ${chatId} (best-effort)`, { error: String(error) });
        }
    }
    async sendImageMessage(chatId, media) {
        this.ensureReady();
        const { data, mimetype } = await this.resolveMediaBuffer(media);
        return this.sendContent(chatId, {
            image: data,
            caption: media.caption,
            mimetype,
            ...this.withMentions(media.mentions),
        });
    }
    async sendVideoMessage(chatId, media) {
        this.ensureReady();
        const { data, mimetype } = await this.resolveMediaBuffer(media);
        return this.sendContent(chatId, {
            video: data,
            caption: media.caption,
            mimetype,
            ...this.withMentions(media.mentions),
        });
    }
    async sendAudioMessage(chatId, media) {
        this.ensureReady();
        const { data, mimetype } = await this.resolveMediaBuffer(media);
        return this.sendContent(chatId, { audio: data, mimetype, ptt: media.ptt ?? false });
    }
    async sendDocumentMessage(chatId, media) {
        this.ensureReady();
        const { data, mimetype } = await this.resolveMediaBuffer(media);
        return this.sendContent(chatId, {
            document: data,
            mimetype,
            fileName: media.filename ?? 'file',
            caption: media.caption,
            ...this.withMentions(media.mentions),
        });
    }
    async sendStickerMessage(chatId, media) {
        this.ensureReady();
        const { data } = await this.resolveMediaBuffer(media);
        return this.sendContent(chatId, { sticker: data });
    }
    async sendLocationMessage(chatId, location) {
        this.ensureReady();
        return this.sendContent(chatId, {
            location: {
                degreesLatitude: location.latitude,
                degreesLongitude: location.longitude,
                name: location.description,
                address: location.address,
            },
        });
    }
    async sendContactMessage(chatId, contact) {
        this.ensureReady();
        return this.sendContent(chatId, {
            contacts: { displayName: contact.name, contacts: [{ vcard: (0, vcard_1.buildVCard)(contact) }] },
        });
    }
    async sendPollMessage(chatId, poll) {
        this.ensureReady();
        return this.sendContent(chatId, {
            poll: {
                name: poll.name,
                values: poll.options,
                selectableCount: poll.allowMultipleAnswers ? 0 : 1,
            },
        });
    }
    async replyToMessage(chatId, quotedMsgId, text) {
        this.ensureReady();
        const quoted = await this.requireStored(quotedMsgId);
        return this.sendContent(chatId, { text }, { quoted });
    }
    async forwardMessage(fromChatId, toChatId, messageId) {
        this.ensureReady();
        const forward = await this.requireStored(messageId);
        return this.sendContent(toChatId, { forward });
    }
    async reactToMessage(chatId, messageId, emoji) {
        this.ensureReady();
        const target = await this.requireStored(messageId);
        await this.sock.sendMessage(chatId, { react: { text: emoji, key: target.key } });
    }
    async deleteMessage(chatId, messageId, forEveryone = true) {
        this.ensureReady();
        if (!forEveryone) {
            throw new engine_not_supported_error_1.EngineNotSupportedError('deleteMessage (delete-for-me)');
        }
        const target = await this.requireStored(messageId);
        await this.sock.sendMessage(chatId, { delete: target.key });
    }
    async getGroups() {
        this.ensureReady();
        const all = await this.sock.groupFetchAllParticipating();
        const self = this.normalizedSelfJid();
        return Object.values(all).map(metadata => (0, baileys_group_mapper_1.mapBaileysGroup)(metadata, self, jid => this.sessionStore.toNeutralJid(jid)));
    }
    async getGroupInfo(groupId) {
        this.ensureReady();
        try {
            const metadata = await this.sock.groupMetadata(groupId);
            return (0, baileys_group_mapper_1.mapBaileysGroupInfo)(metadata, jid => this.sessionStore.toNeutralJid(jid));
        }
        catch (err) {
            this.logger.debug('groupMetadata failed; treating as not-found', {
                groupId,
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }
    async createGroup(name, participants) {
        this.ensureReady();
        const metadata = await this.sock.groupCreate(name, this.toEngineParticipants(participants));
        return (0, baileys_group_mapper_1.mapBaileysGroup)(metadata, this.normalizedSelfJid(), jid => this.sessionStore.toNeutralJid(jid));
    }
    async addParticipants(groupId, participants) {
        this.ensureReady();
        await this.sock.groupParticipantsUpdate(groupId, this.toEngineParticipants(participants), 'add');
    }
    async removeParticipants(groupId, participants) {
        this.ensureReady();
        await this.sock.groupParticipantsUpdate(groupId, this.toEngineParticipants(participants), 'remove');
    }
    async promoteParticipants(groupId, participants) {
        this.ensureReady();
        await this.sock.groupParticipantsUpdate(groupId, this.toEngineParticipants(participants), 'promote');
    }
    async demoteParticipants(groupId, participants) {
        this.ensureReady();
        await this.sock.groupParticipantsUpdate(groupId, this.toEngineParticipants(participants), 'demote');
    }
    toEngineParticipants(participants) {
        return participants.map(p => this.sessionStore.toEngineJid(p));
    }
    withMentions(mentions) {
        return mentions?.length ? { mentions: this.toEngineParticipants(mentions) } : {};
    }
    async leaveGroup(groupId) {
        this.ensureReady();
        await this.sock.groupLeave(groupId);
    }
    async setGroupSubject(groupId, subject) {
        this.ensureReady();
        await this.sock.groupUpdateSubject(groupId, subject);
    }
    async setGroupDescription(groupId, description) {
        this.ensureReady();
        await this.sock.groupUpdateDescription(groupId, description);
    }
    async getGroupInviteCode(groupId) {
        this.ensureReady();
        return (await this.sock.groupInviteCode(groupId)) ?? '';
    }
    async revokeGroupInviteCode(groupId) {
        this.ensureReady();
        return (await this.sock.groupRevokeInvite(groupId)) ?? '';
    }
    async getProfilePicture(contactId) {
        this.ensureReady();
        try {
            return (await this.sock.profilePictureUrl(contactId, 'image')) ?? null;
        }
        catch (err) {
            this.logger.debug('profilePictureUrl failed; no picture or hidden', {
                contactId,
                error: err instanceof Error ? err.message : String(err),
            });
            return null;
        }
    }
    async blockContact(contactId) {
        this.ensureReady();
        await this.sock.updateBlockStatus(contactId, 'block');
    }
    async unblockContact(contactId) {
        this.ensureReady();
        await this.sock.updateBlockStatus(contactId, 'unblock');
    }
    async getContacts() {
        this.ensureReady();
        return this.sessionStore.listContacts();
    }
    async getContactById(contactId) {
        this.ensureReady();
        return this.sessionStore.findContact(contactId);
    }
    async resolveContactPhone(contactId) {
        this.ensureReady();
        return this.sessionStore.resolvePhone(contactId);
    }
    async getChats() {
        this.ensureReady();
        return this.sessionStore.listChats();
    }
    async sendSeen(chatId) {
        this.ensureReady();
        const last = this.sessionStore.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.sock.readMessages([last.key]);
        return true;
    }
    async markUnread(chatId) {
        this.ensureReady();
        const last = this.sessionStore.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.sock.chatModify({ markRead: false, lastMessages: [{ key: last.key, messageTimestamp: last.timestamp }] }, chatId);
        return true;
    }
    async deleteChat(chatId) {
        this.ensureReady();
        const last = this.sessionStore.lastMessage(chatId);
        if (!last) {
            return false;
        }
        await this.sock.chatModify({ delete: true, lastMessages: [{ key: last.key, messageTimestamp: last.timestamp }] }, chatId);
        return true;
    }
    getMessageReactions(_chatId, _messageId) {
        return this.unsupported('getMessageReactions');
    }
    getChatHistory(_chatId, _limit, _includeMedia) {
        return this.unsupported('getChatHistory');
    }
    getLabels() {
        return this.unsupported('getLabels');
    }
    getLabelById(_labelId) {
        return this.unsupported('getLabelById');
    }
    getChatLabels(_chatId) {
        return this.unsupported('getChatLabels');
    }
    addLabelToChat(_chatId, _labelId) {
        return this.unsupported('addLabelToChat');
    }
    removeLabelFromChat(_chatId, _labelId) {
        return this.unsupported('removeLabelFromChat');
    }
    getSubscribedChannels() {
        return this.unsupported('getSubscribedChannels');
    }
    getChannelById(_channelId) {
        return this.unsupported('getChannelById');
    }
    subscribeToChannel(_inviteCode) {
        return this.unsupported('subscribeToChannel');
    }
    unsubscribeFromChannel(_channelId) {
        return this.unsupported('unsubscribeFromChannel');
    }
    getChannelMessages(_channelId, _limit) {
        return this.unsupported('getChannelMessages');
    }
    getContactStatuses() {
        return this.unsupported('getContactStatuses');
    }
    getContactStatus(_contactId) {
        return this.unsupported('getContactStatus');
    }
    postTextStatus(text, options) {
        return this.postStatus({ text }, options);
    }
    postImageStatus(media, options) {
        return this.postMediaStatus('image', media, options);
    }
    postVideoStatus(media, options) {
        return this.postMediaStatus('video', media, options);
    }
    async postMediaStatus(kind, media, options) {
        this.ensureReady();
        const { data, mimetype } = await this.resolveMediaBuffer(media);
        const content = kind === 'image'
            ? { image: data, caption: options.caption, mimetype }
            : { video: data, caption: options.caption, mimetype };
        return this.postStatus(content, options);
    }
    async deleteStatus(statusId) {
        this.ensureReady();
        await this.sock.sendMessage('status@broadcast', {
            delete: {
                remoteJid: 'status@broadcast',
                fromMe: true,
                id: statusId,
                participant: this.sessionStore.toEngineJid(this.normalizedSelfJid()),
            },
        });
    }
    getCatalog() {
        return this.unsupported('getCatalog');
    }
    getProducts(_options) {
        return this.unsupported('getProducts');
    }
    getProduct(_productId) {
        return this.unsupported('getProduct');
    }
    sendProduct(_chatId, _productId, _body) {
        return this.unsupported('sendProduct');
    }
    sendCatalog(_chatId, _body) {
        return this.unsupported('sendCatalog');
    }
    handleMessagesUpsert(event) {
        if (event.type !== 'notify') {
            return;
        }
        for (const msg of event.messages) {
            if (!msg.message || !msg.key?.remoteJid) {
                continue;
            }
            void this.inboundLimiter.run(() => this.processInboundMessage(msg));
        }
    }
    logContactEvent(event, records = []) {
        const list = records ?? [];
        this.logger.debug('Baileys contacts event', {
            action: 'baileys_contacts',
            event,
            count: list.length,
            withName: list.filter(r => r.name || r.notify || r.verifiedName).length,
            withLid: list.filter(r => r.lid).length,
            sample: list.slice(0, 3).map(r => ({ id: r.id, name: r.name, notify: r.notify, lid: r.lid, jid: r.jid })),
        });
    }
    async processInboundMessage(msg) {
        try {
            const b = await this.loadLib();
            const remoteJid = msg.key.remoteJid;
            this.sessionStore.recordKeyLidMappings(msg.key);
            const normalizedRoot = b.normalizeMessageContent(msg.message ?? undefined) ?? msg.message ?? undefined;
            const contentType = b.getContentType(normalizedRoot);
            if (contentType === 'protocolMessage') {
                const pm = msg.message?.protocolMessage;
                if (pm?.type === b.proto.Message.ProtocolMessage.Type.REVOKE) {
                    const from = msg.key.fromMe === true ? this.normalizedSelfJid() : remoteJid;
                    const to = msg.key.fromMe === true ? remoteJid : this.normalizedSelfJid();
                    const revoked = {
                        id: pm.key?.id ?? '',
                        revokedId: pm.key?.id ?? undefined,
                        chatId: this.sessionStore.toNeutralJid(remoteJid),
                        from: this.sessionStore.toNeutralJid(from),
                        to: this.sessionStore.toNeutralJid(to),
                        type: 'revoked',
                        body: '',
                        timestamp: this.toUnixSeconds(msg.messageTimestamp),
                    };
                    this.callbacks.onMessageRevoked?.(revoked);
                    return;
                }
                return;
            }
            if (contentType === 'reactionMessage') {
                const rm = msg.message?.reactionMessage;
                const event = {
                    messageId: rm?.key?.id ?? '',
                    chatId: this.sessionStore.toNeutralJid(remoteJid),
                    reaction: rm?.text ?? '',
                    senderId: this.sessionStore.toNeutralJid(msg.key.participant ?? remoteJid),
                };
                this.callbacks.onMessageReaction?.(event);
                return;
            }
            const incoming = await this.mapMessage(msg, contentType);
            if (msg.key.fromMe === true) {
                this.callbacks.onMessageCreate?.(incoming);
            }
            else {
                this.callbacks.onMessage?.(incoming);
            }
            void this.config.messageStore?.put(this.config.sessionId, msg).catch(err => this.logger.warn('Failed to persist message to store', {
                error: err instanceof Error ? err.message : String(err),
            }));
            this.sessionStore.recordMessage(msg);
        }
        catch (err) {
            this.logger.error(`Unhandled error processing inbound message (id=${msg.key?.id ?? 'unknown'}); dropping`, err instanceof Error ? err.message : String(err));
        }
    }
    handleMessagesUpdate(updates) {
        for (const u of updates) {
            const status = (0, baileys_message_mapper_1.mapBaileysStatus)(u.update?.status);
            if (status && u.key?.id) {
                this.callbacks.onMessageAck?.(u.key.id, status);
            }
        }
    }
    async downloadInboundMediaCapped(msg, maxBytes) {
        let stream;
        const download = (async () => {
            const b = await this.loadLib();
            stream = (await b.downloadMediaMessage(msg, 'stream', {}, {
                logger: createSilentLogger(),
                reuploadRequest: this.sock.updateMediaMessage,
            }));
            const chunks = [];
            let total = 0;
            for await (const chunk of stream) {
                total += chunk.length;
                if (total > maxBytes) {
                    stream.destroy?.();
                    return null;
                }
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        })();
        return (0, inbound_media_cap_1.withInboundDownloadTimeout)(download, (0, inbound_media_cap_1.inboundMediaTimeoutMs)(), () => stream?.destroy?.());
    }
    async mapMessage(msg, contentType, opts) {
        const b = await this.loadLib();
        const content = msg.message ?? {};
        const normalized = b.normalizeMessageContent(content) ?? content;
        const body = (0, baileys_message_mapper_1.extractBaileysBody)(normalized);
        let location;
        if (contentType === 'locationMessage' || contentType === 'liveLocationMessage') {
            const lm = normalized.locationMessage ?? normalized.liveLocationMessage;
            if (lm) {
                const staticLm = normalized.locationMessage;
                location = {
                    latitude: lm.degreesLatitude ?? 0,
                    longitude: lm.degreesLongitude ?? 0,
                    description: staticLm?.name ?? undefined,
                    address: staticLm?.address ?? undefined,
                };
            }
        }
        let media;
        const isMediaType = contentType === 'imageMessage' ||
            contentType === 'videoMessage' ||
            contentType === 'audioMessage' ||
            contentType === 'documentMessage' ||
            contentType === 'documentWithCaptionMessage' ||
            contentType === 'stickerMessage';
        if (isMediaType) {
            if (opts?.skipMediaDownload || !(0, inbound_media_cap_1.isMediaDownloadEnabled)()) {
                const normalizedContent = b.normalizeMessageContent(content) ?? content;
                const subMessage = normalizedContent.imageMessage ??
                    normalizedContent.videoMessage ??
                    normalizedContent.audioMessage ??
                    normalizedContent.documentMessage ??
                    normalizedContent.stickerMessage;
                media = {
                    mimetype: subMessage?.mimetype ?? '',
                    filename: normalizedContent.documentMessage?.fileName ?? undefined,
                    omitted: true,
                    sizeBytes: (0, inbound_media_cap_1.coerceDeclaredSize)(subMessage?.fileLength),
                };
            }
            else {
                const normalizedContent = b.normalizeMessageContent(content) ?? content;
                const subMessage = normalizedContent.imageMessage ??
                    normalizedContent.videoMessage ??
                    normalizedContent.audioMessage ??
                    normalizedContent.documentMessage ??
                    normalizedContent.stickerMessage;
                const mimetype = subMessage?.mimetype ?? '';
                const filename = normalizedContent.documentMessage?.fileName ?? undefined;
                const maxBytes = (0, inbound_media_cap_1.inboundMediaMaxBytes)();
                const declared = (0, inbound_media_cap_1.coerceDeclaredSize)(subMessage?.fileLength);
                if (declared > maxBytes) {
                    media = { mimetype, filename, omitted: true, sizeBytes: declared };
                    this.logger.warn('Inbound media declared size exceeds MEDIA_DOWNLOAD_MAX_BYTES; skipped download', {
                        msgId: msg.key.id,
                        sizeBytes: declared,
                    });
                }
                else {
                    try {
                        const buf = await this.downloadInboundMediaCapped(msg, maxBytes);
                        if (buf === null) {
                            media = { mimetype, filename, omitted: true, sizeBytes: maxBytes };
                            this.logger.warn('Inbound media download aborted (over MEDIA_DOWNLOAD_MAX_BYTES or past MEDIA_DOWNLOAD_TIMEOUT_MS); emitting omitted marker', { msgId: msg.key.id });
                        }
                        else {
                            media = (0, inbound_media_cap_1.capInboundMedia)({
                                mimetype,
                                filename,
                                sizeBytes: buf.byteLength,
                                toBase64: () => buf.toString('base64'),
                            });
                        }
                    }
                    catch (err) {
                        this.logger.debug('Failed to download inbound media; emitting message without media', {
                            error: err instanceof Error ? err.message : String(err),
                            msgId: msg.key.id,
                        });
                    }
                }
            }
        }
        let quotedMessage;
        const normalizedForContext = b.normalizeMessageContent(content) ?? content;
        const subForContext = normalizedForContext.extendedTextMessage ??
            normalizedForContext.imageMessage ??
            normalizedForContext.videoMessage ??
            normalizedForContext.audioMessage ??
            normalizedForContext.documentMessage ??
            normalizedForContext.stickerMessage ??
            normalizedForContext.locationMessage;
        const contextInfo = subForContext?.contextInfo;
        if (contextInfo?.quotedMessage && contextInfo.stanzaId) {
            const qm = contextInfo.quotedMessage;
            const qBody = qm.conversation ??
                qm.extendedTextMessage?.text ??
                qm.imageMessage?.caption ??
                qm.videoMessage?.caption ??
                qm.documentMessage?.caption ??
                '';
            quotedMessage = { id: contextInfo.stanzaId, body: qBody };
        }
        return (0, baileys_message_mapper_1.buildIncomingMessageFromBaileys)({
            id: msg.key.id ?? '',
            remoteJid: msg.key.remoteJid,
            fromMe: msg.key.fromMe === true,
            participant: msg.key.participant ?? undefined,
            body,
            contentType,
            isPtt: normalized.audioMessage?.ptt === true,
            timestamp: this.toUnixSeconds(msg.messageTimestamp),
            pushName: msg.pushName ?? undefined,
            selfJid: this.normalizedSelfJid(),
            media,
            location,
            quotedMessage,
            ephemeralDuration: contextInfo?.expiration ?? undefined,
            mentionedJids: contextInfo?.mentionedJid ?? undefined,
        }, jid => this.sessionStore.toNeutralJid(jid));
    }
    async captureHistoryMessages(messages) {
        if (!messages.length) {
            return;
        }
        const b = await this.loadLib();
        const nameUpdates = [];
        const mapped = [];
        for (const msg of messages) {
            if (msg.key?.fromMe !== true && msg.pushName) {
                const sender = msg.key?.participant ?? msg.key?.remoteJid;
                if (sender) {
                    nameUpdates.push({ id: sender, notify: msg.pushName });
                }
            }
            this.sessionStore.recordMessage(msg);
            const incoming = this.mapHistoryMessage(b, msg);
            if (incoming) {
                mapped.push(incoming);
            }
        }
        if (nameUpdates.length) {
            this.sessionStore.upsertContacts(nameUpdates);
        }
        if (mapped.length) {
            this.callbacks.onHistoryMessages?.(mapped);
        }
    }
    async hydrateNames() {
        try {
            const groups = await this.sock.groupFetchAllParticipating();
            const named = Object.values(groups)
                .filter(g => g?.id && g.subject)
                .map(g => ({ id: g.id, name: g.subject }));
            if (named.length) {
                this.sessionStore.upsertChats(named);
                this.logger.debug('Hydrated group names', { action: 'baileys_hydrate_groups', count: named.length });
            }
        }
        catch (err) {
            this.logger.warn('Group name hydration failed', { error: err instanceof Error ? err.message : String(err) });
        }
        try {
            const b = await this.loadLib();
            await this.sock.resyncAppState(b.ALL_WA_PATCH_NAMES, false);
            this.logger.debug('Re-synced app state for contact names', { action: 'baileys_resync_appstate' });
        }
        catch (err) {
            this.logger.warn('App-state resync for contact names failed', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    mapHistoryMessage(b, msg) {
        const raw = msg.message;
        if (!raw || !msg.key?.remoteJid || !msg.key.id) {
            return null;
        }
        const content = b.normalizeMessageContent(raw) ?? raw;
        const contentType = b.getContentType(content);
        if (!contentType ||
            contentType === 'protocolMessage' ||
            contentType === 'reactionMessage' ||
            contentType === 'senderKeyDistributionMessage') {
            return null;
        }
        const body = (0, baileys_message_mapper_1.extractBaileysBody)(content);
        return (0, baileys_message_mapper_1.buildIncomingMessageFromBaileys)({
            id: msg.key.id,
            remoteJid: msg.key.remoteJid,
            fromMe: msg.key.fromMe === true,
            participant: msg.key.participant ?? undefined,
            body,
            contentType,
            isPtt: content.audioMessage?.ptt === true,
            timestamp: this.toUnixSeconds(msg.messageTimestamp),
            pushName: msg.pushName ?? undefined,
            selfJid: this.normalizedSelfJid(),
        }, jid => this.sessionStore.toNeutralJid(jid));
    }
    normalizedSelfJid() {
        const phone = this.extractPhone(this.sock?.user?.id);
        return phone ? `${phone}@s.whatsapp.net` : '';
    }
    toUnixSeconds(ts) {
        if (ts == null) {
            return Math.floor(Date.now() / 1000);
        }
        return typeof ts === 'number' ? ts : ts.toNumber();
    }
    async resolveMediaBuffer(media) {
        if (Buffer.isBuffer(media.data)) {
            return { data: media.data, mimetype: media.mimetype };
        }
        if (/^https?:\/\//i.test(media.data)) {
            const fetched = await (0, load_remote_media_1.loadRemoteMediaBuffer)(media.data);
            return { data: fetched.data, mimetype: media.mimetype || fetched.mimetype };
        }
        return { data: Buffer.from(media.data, 'base64'), mimetype: media.mimetype };
    }
    withEphemeral(chatId, options) {
        const ephemeralExpiration = this.sessionStore.getEphemeralExpiration(chatId);
        if (ephemeralExpiration === undefined) {
            return options;
        }
        return { ...options, ephemeralExpiration };
    }
    async sendContent(chatId, content, options) {
        const merged = this.withEphemeral(chatId, options);
        const sent = merged
            ? await this.sock.sendMessage(chatId, content, merged)
            : await this.sock.sendMessage(chatId, content);
        if (sent) {
            void this.config.messageStore?.put(this.config.sessionId, sent).catch(err => this.logger.warn('Failed to persist sent message to store', {
                error: err instanceof Error ? err.message : String(err),
            }));
            void this.emitOwnSendEcho(sent);
        }
        return { id: sent?.key?.id ?? '', timestamp: this.toUnixSeconds(sent?.messageTimestamp) };
    }
    async emitOwnSendEcho(sent) {
        if (!this.callbacks.onMessageCreate)
            return;
        try {
            const b = await this.loadLib();
            if (!sent.message || !sent.key?.remoteJid)
                return;
            const normalizedRoot = b.normalizeMessageContent(sent.message) ?? sent.message;
            const contentType = b.getContentType(normalizedRoot);
            if (!contentType || contentType === 'protocolMessage' || contentType === 'reactionMessage')
                return;
            const neutral = await this.mapMessage(sent, contentType, { skipMediaDownload: true });
            this.callbacks.onMessageCreate(neutral);
        }
        catch (err) {
            this.logger.warn('Failed to emit own-send echo', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async requireStored(messageId) {
        const found = await this.config.messageStore?.getMessage(this.config.sessionId, messageId);
        if (!found?.key) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId);
        }
        return found;
    }
    async postStatus(content, options) {
        this.ensureReady();
        const statusJidList = options.recipients.map(r => this.sessionStore.toEngineJid(r));
        const sent = await this.sock.sendMessage('status@broadcast', content, {
            statusJidList,
            backgroundColor: options.backgroundColor,
            font: options.font,
        });
        return this.toStatusResult(sent);
    }
    toStatusResult(sent) {
        const ts = sent?.messageTimestamp ? new Date(this.toUnixSeconds(sent.messageTimestamp) * 1000) : new Date();
        return {
            statusId: sent?.key?.id ?? '',
            timestamp: ts,
            expiresAt: new Date(ts.getTime() + 24 * 3_600_000),
        };
    }
    unsupported(method) {
        return Promise.reject(new engine_not_supported_error_1.EngineNotSupportedError(method));
    }
    ensureReady() {
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.READY || !this.sock) {
            throw new engine_not_ready_error_1.EngineNotReadyError();
        }
    }
    setStatus(status) {
        if (this.status === status) {
            return;
        }
        this.status = status;
        this.callbacks.onStateChanged?.(status);
    }
    extractPhone(id) {
        if (!id) {
            return null;
        }
        return id.split(':')[0].split('@')[0] || null;
    }
}
exports.BaileysAdapter = BaileysAdapter;
//# sourceMappingURL=baileys.adapter.js.map