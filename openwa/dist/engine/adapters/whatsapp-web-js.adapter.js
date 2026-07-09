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
exports.WhatsAppWebJsAdapter = void 0;
exports.wwebjsAckToDeliveryStatus = wwebjsAckToDeliveryStatus;
exports.extractWwebjsCall = extractWwebjsCall;
exports.isSupportedProxyUrl = isSupportedProxyUrl;
exports.buildProxyLaunchConfig = buildProxyLaunchConfig;
exports.isHttpUrl = isHttpUrl;
exports.loadRemoteMedia = loadRemoteMedia;
exports.resolveAuthTimeoutMs = resolveAuthTimeoutMs;
exports.extractLinkedParentJID = extractLinkedParentJID;
exports.isNoLidForUserError = isNoLidForUserError;
const events_1 = require("events");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode = __importStar(require("qrcode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const whatsapp_engine_interface_1 = require("../interfaces/whatsapp-engine.interface");
const wa_web_version_1 = require("../wa-web-version");
const wa_id_1 = require("../identity/wa-id");
const chat_labels_unsupported_error_1 = require("../../common/errors/chat-labels-unsupported.error");
const logger_service_1 = require("../../common/services/logger.service");
const engine_not_ready_error_1 = require("../../common/errors/engine-not-ready.error");
const engine_not_supported_error_1 = require("../../common/errors/engine-not-supported.error");
const message_not_found_error_1 = require("../../common/errors/message-not-found.error");
const channel_not_found_error_1 = require("../../common/errors/channel-not-found.error");
const load_remote_media_1 = require("../../common/media/load-remote-media");
const message_mapper_1 = require("./message-mapper");
const vcard_1 = require("./vcard");
const inbound_media_cap_1 = require("./inbound-media-cap");
const concurrency_limiter_1 = require("./concurrency-limiter");
function wwebjsAckToDeliveryStatus(ack) {
    if (ack < 0)
        return 'failed';
    if (ack >= 3)
        return 'read';
    if (ack === 2)
        return 'delivered';
    if (ack === 1)
        return 'sent';
    return 'pending';
}
function extractWwebjsCall(msg) {
    if (msg.type !== 'call_log')
        return undefined;
    const d = msg._data ?? {};
    return { video: Boolean(d.isVideoCall), missed: !msg.fromMe && !d.callDuration };
}
function isSupportedProxyUrl(url) {
    try {
        return ['http:', 'https:', 'socks4:', 'socks5:'].includes(new URL(url).protocol);
    }
    catch {
        return false;
    }
}
function buildProxyLaunchConfig(url) {
    const parsed = new URL(url);
    const serverArg = `${parsed.protocol}//${parsed.host}`;
    const username = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const hasCredentials = username !== '' || password !== '';
    const isSocks = parsed.protocol === 'socks4:' || parsed.protocol === 'socks5:';
    if (hasCredentials && !isSocks) {
        return { serverArg, proxyAuthentication: { username, password }, socksAuthUnsupported: false };
    }
    return { serverArg, socksAuthUnsupported: hasCredentials && isSocks };
}
function isHttpUrl(value) {
    return /^https?:\/\//i.test(value);
}
async function loadRemoteMedia(url) {
    const { data, mimetype } = await (0, load_remote_media_1.loadRemoteMediaBuffer)(url);
    const filename = new URL(url).pathname.split('/').pop() || undefined;
    return new whatsapp_web_js_1.MessageMedia(mimetype || 'application/octet-stream', data.toString('base64'), filename);
}
const READY_RECONCILE_INTERVAL_MS = 2000;
const READY_RECONCILE_TIMEOUT_MS = 90_000;
function resolveAuthTimeoutMs() {
    const raw = process.env.WWEBJS_AUTH_TIMEOUT_MS?.trim();
    if (!raw || !/^\d+$/.test(raw)) {
        return undefined;
    }
    const ms = Number(raw);
    return Number.isSafeInteger(ms) && ms > 0 ? ms : undefined;
}
function extractLinkedParentJID(groupMetadata) {
    const candidate = groupMetadata?.parentGroup ?? groupMetadata?.linkedParentGroup ?? groupMetadata?.linkedParent ?? null;
    if (!candidate) {
        return null;
    }
    if (typeof candidate === 'string') {
        return candidate;
    }
    return candidate._serialized ?? null;
}
function isNoLidForUserError(err) {
    return err instanceof Error && err.message.includes('No LID for user');
}
class WhatsAppWebJsAdapter extends events_1.EventEmitter {
    config;
    client = null;
    status = whatsapp_engine_interface_1.EngineStatus.DISCONNECTED;
    qrCode = null;
    phoneNumber = null;
    pushName = null;
    callbacks = {};
    readyReconcileTimer = null;
    readyReconcileStartedAt = 0;
    readyReconcileProbeInFlight = false;
    stuckAuthRecoveryAttempted = false;
    tearingDown = false;
    constructor(config) {
        super();
        this.config = config;
    }
    logger = (0, logger_service_1.createLogger)('WhatsAppWebJsAdapter');
    inboundLimiter = new concurrency_limiter_1.ConcurrencyLimiter((0, inbound_media_cap_1.inboundMediaConcurrency)());
    async capInboundMediaFor(msg) {
        if (!(0, inbound_media_cap_1.isMediaDownloadEnabled)()) {
            const data = msg._data;
            return {
                mimetype: data?.mimetype ?? '',
                filename: data?.filename || undefined,
                omitted: true,
                sizeBytes: (0, inbound_media_cap_1.coerceDeclaredSize)(data?.size),
            };
        }
        const maxBytes = (0, inbound_media_cap_1.inboundMediaMaxBytes)();
        const data = msg._data;
        const declared = (0, inbound_media_cap_1.coerceDeclaredSize)(data?.size);
        if (declared > maxBytes) {
            this.logger.warn('Inbound media declared size exceeds MEDIA_DOWNLOAD_MAX_BYTES; skipped download', {
                msgId: msg.id._serialized,
                sizeBytes: declared,
            });
            return {
                mimetype: data?.mimetype ?? '',
                filename: data?.filename || undefined,
                omitted: true,
                sizeBytes: declared,
            };
        }
        let resolveBounded = () => undefined;
        const boundedReady = new Promise(resolve => {
            resolveBounded = resolve;
        });
        const slotHeld = this.inboundLimiter.run(() => {
            const download = msg.downloadMedia();
            resolveBounded((0, inbound_media_cap_1.withInboundDownloadTimeout)(download, (0, inbound_media_cap_1.inboundMediaTimeoutMs)(), () => this.logger.warn('Inbound media download timed out (MEDIA_DOWNLOAD_TIMEOUT_MS); emitting message without media', {
                msgId: msg.id._serialized,
            })));
            return download.then(() => undefined, () => undefined);
        });
        void slotHeld.catch(() => undefined);
        const media = await boundedReady;
        if (!media)
            return undefined;
        const capped = (0, inbound_media_cap_1.capInboundMedia)({
            mimetype: media.mimetype,
            filename: media.filename || undefined,
            sizeBytes: Buffer.byteLength(media.data, 'base64'),
            toBase64: () => media.data,
        });
        if (capped.omitted) {
            this.logger.warn('Inbound media exceeds MEDIA_DOWNLOAD_MAX_BYTES; dropped payload, kept envelope', {
                msgId: msg.id._serialized,
                sizeBytes: capped.sizeBytes,
            });
        }
        return capped;
    }
    async initialize(callbacks) {
        this.callbacks = callbacks;
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.INITIALIZING);
        try {
            const puppeteerArgs = this.config.puppeteer?.args || [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
            ];
            let proxyAuthentication;
            if (this.config.proxy) {
                if (isSupportedProxyUrl(this.config.proxy.url)) {
                    const proxyLaunch = buildProxyLaunchConfig(this.config.proxy.url);
                    puppeteerArgs.push(`--proxy-server=${proxyLaunch.serverArg}`);
                    proxyAuthentication = proxyLaunch.proxyAuthentication;
                    if (proxyLaunch.socksAuthUnsupported) {
                        this.logger.warn(`Proxy for session ${this.config.sessionId} has credentials on a SOCKS proxy, but Chromium ` +
                            `cannot authenticate SOCKS proxies. Use an IP-authorized proxy or an HTTP/HTTPS proxy instead.`);
                    }
                    this.logger.log(`Using proxy: ${proxyLaunch.serverArg}`);
                }
                else {
                    this.logger.warn(`Ignoring invalid proxy URL for session ${this.config.sessionId}`);
                }
            }
            const versionPin = await (0, wa_web_version_1.resolveWebVersionPin)();
            if (versionPin) {
                this.logger.log(`Pinning WhatsApp Web version ${versionPin.webVersion}`);
            }
            const authTimeoutMs = resolveAuthTimeoutMs();
            if (authTimeoutMs) {
                this.logger.log(`Using auth timeout ${authTimeoutMs}ms`);
            }
            this.client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth({
                    clientId: this.config.sessionId,
                    dataPath: path.resolve(this.config.sessionDataPath),
                }),
                puppeteer: {
                    headless: this.config.puppeteer?.headless ?? true,
                    args: puppeteerArgs,
                    handleSIGINT: false,
                    handleSIGTERM: false,
                    handleSIGHUP: false,
                    ...(this.config.puppeteer?.executablePath ? { executablePath: this.config.puppeteer.executablePath } : {}),
                },
                ...(authTimeoutMs !== undefined ? { authTimeoutMs } : {}),
                ...(proxyAuthentication ? { proxyAuthentication } : {}),
                ...(versionPin ?? {}),
            });
            this.setupEventHandlers();
            await this.client.initialize();
        }
        catch (error) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            const reason = error instanceof Error ? error.message : String(error);
            this.callbacks.onError?.(reason);
            throw error;
        }
    }
    setupEventHandlers() {
        if (!this.client)
            return;
        this.client.on('qr', async (qr) => {
            if (this.tearingDown || this.status === whatsapp_engine_interface_1.EngineStatus.FAILED || !this.client) {
                return;
            }
            try {
                this.qrCode = await qrcode.toDataURL(qr);
                this.setStatus(whatsapp_engine_interface_1.EngineStatus.QR_READY);
                this.callbacks.onQRCode?.(this.qrCode);
            }
            catch (error) {
                this.logger.error('Error generating QR code', String(error));
            }
        });
        this.client.on('authenticated', () => {
            if (this.tearingDown ||
                this.status === whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING ||
                this.status === whatsapp_engine_interface_1.EngineStatus.READY ||
                this.status === whatsapp_engine_interface_1.EngineStatus.FAILED) {
                return;
            }
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING);
            this.qrCode = null;
            this.scheduleReadyReconcile();
        });
        this.client.on('ready', () => {
            this.markReadyFromClientInfo();
        });
        this.client.on('message', async (msg) => {
            try {
                const incomingMessage = (0, message_mapper_1.buildIncomingMessageBase)(msg);
                try {
                    const contact = await msg.getContact();
                    if (contact) {
                        const full = process.env.WEBHOOK_CONTACT_DETAILS === 'true';
                        const merged = { ...incomingMessage.contact, ...(0, message_mapper_1.mapContactFields)(contact, full) };
                        if (Object.keys(merged).length > 0) {
                            incomingMessage.contact = merged;
                        }
                    }
                }
                catch (error) {
                    this.logger.error('Error getting message contact', String(error));
                }
                if (msg.type === whatsapp_web_js_1.MessageTypes.LOCATION && msg.location) {
                    incomingMessage.location = {
                        latitude: Number(msg.location.latitude),
                        longitude: Number(msg.location.longitude),
                        description: msg.location.description || undefined,
                        address: msg.location.address || undefined,
                        url: msg.location.url || undefined,
                    };
                }
                if (msg.hasMedia) {
                    try {
                        const capped = await this.capInboundMediaFor(msg);
                        if (capped)
                            incomingMessage.media = capped;
                    }
                    catch (error) {
                        this.logger.error('Error downloading media', String(error));
                    }
                }
                if (msg.hasQuotedMsg) {
                    try {
                        const quoted = await msg.getQuotedMessage();
                        incomingMessage.quotedMessage = {
                            id: quoted.id._serialized,
                            body: quoted.body,
                        };
                    }
                    catch (error) {
                        this.logger.error('Error getting quoted message', String(error));
                    }
                }
                const call = extractWwebjsCall(msg);
                if (call)
                    incomingMessage.call = call;
                this.callbacks.onMessage?.(incomingMessage);
            }
            catch (error) {
                this.logger.error('Error processing incoming message', String(error));
            }
        });
        this.client.on('message_create', msg => {
            if (!msg.fromMe) {
                return;
            }
            try {
                this.callbacks.onMessageCreate?.((0, message_mapper_1.buildIncomingMessageBase)(msg));
            }
            catch (error) {
                this.logger.error('Error processing outgoing message', String(error));
            }
        });
        this.client.on('message_ack', (msg, ack) => {
            this.callbacks.onMessageAck?.(msg.id._serialized, wwebjsAckToDeliveryStatus(ack));
        });
        this.client.on('message_revoke_everyone', (after, before) => {
            try {
                const selfWid = this.client?.info?.wid?._serialized;
                const payload = {
                    id: after.id._serialized,
                    revokedId: before?.id?._serialized,
                    chatId: after.from === selfWid ? after.to : after.from,
                    from: after.from,
                    to: after.to,
                    type: 'revoked',
                    body: '',
                    timestamp: after.timestamp,
                };
                this.callbacks.onMessageRevoked?.(payload);
            }
            catch (error) {
                this.logger.error('Error processing message_revoke_everyone', String(error));
            }
        });
        this.client.on('message_reaction', reaction => {
            try {
                const event = {
                    messageId: reaction.msgId._serialized,
                    chatId: reaction.id.remote,
                    reaction: reaction.reaction,
                    senderId: reaction.senderId,
                };
                this.callbacks.onMessageReaction?.(event);
            }
            catch (error) {
                this.logger.error('Error processing message_reaction', String(error));
            }
        });
        this.client.on('disconnected', reason => {
            this.clearReadyReconcile();
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
            this.callbacks.onDisconnected?.(reason);
        });
        this.client.on('auth_failure', (message) => {
            this.clearReadyReconcile();
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            this.callbacks.onError?.(message ? `Authentication failed: ${message}` : 'Authentication failed');
        });
    }
    markReadyFromClientInfo() {
        if ([whatsapp_engine_interface_1.EngineStatus.READY, whatsapp_engine_interface_1.EngineStatus.DISCONNECTED, whatsapp_engine_interface_1.EngineStatus.FAILED].includes(this.status))
            return;
        this.clearReadyReconcile();
        try {
            const info = this.client?.info;
            this.phoneNumber = info?.wid?.user || null;
            this.pushName = info?.pushname || null;
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.READY);
            this.callbacks.onReady?.(this.phoneNumber || '', this.pushName || '');
        }
        catch (error) {
            this.logger.error('Error getting client info', String(error));
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.READY);
            this.callbacks.onReady?.('', '');
        }
    }
    scheduleReadyReconcile() {
        this.clearReadyReconcile();
        this.readyReconcileStartedAt = Date.now();
        const tick = () => {
            if (!this.client || this.status !== whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING) {
                this.clearReadyReconcile();
                return;
            }
            if (Date.now() - this.readyReconcileStartedAt >= READY_RECONCILE_TIMEOUT_MS) {
                this.logger.warn('Timed out waiting for WhatsApp Web runtime readiness after authentication — the saved session ' +
                    'is stuck after the QR scan (usually the auto-selected WhatsApp Web build is incompatible). ' +
                    'Clearing it to re-pair; pin a known-good version via WWEBJS_WEB_VERSION (see ' +
                    'docs/12-troubleshooting-faq.md) if it keeps recurring.');
                this.clearReadyReconcile();
                void this.recoverFromStuckAuth();
                return;
            }
            this.readyReconcileTimer = setTimeout(tick, READY_RECONCILE_INTERVAL_MS);
            this.readyReconcileTimer.unref?.();
            if (this.readyReconcileProbeInFlight)
                return;
            this.readyReconcileProbeInFlight = true;
            void this.isClientRuntimeReady()
                .then(ready => {
                if (ready && this.client && this.status === whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING) {
                    this.logger.warn('WhatsApp Web ready event was missed; reconciling from connected runtime state');
                    this.markReadyFromClientInfo();
                }
            })
                .catch(error => this.logger.debug('Ready reconciliation probe failed', { error: String(error) }))
                .finally(() => {
                this.readyReconcileProbeInFlight = false;
            });
        };
        this.readyReconcileTimer = setTimeout(tick, READY_RECONCILE_INTERVAL_MS);
        this.readyReconcileTimer.unref?.();
    }
    clearReadyReconcile() {
        if (this.readyReconcileTimer) {
            clearTimeout(this.readyReconcileTimer);
            this.readyReconcileTimer = null;
        }
        this.readyReconcileStartedAt = 0;
        this.readyReconcileProbeInFlight = false;
    }
    async recoverFromStuckAuth() {
        if (this.stuckAuthRecoveryAttempted) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.FAILED);
            this.callbacks.onError?.('WhatsApp Web could not reach readiness after re-pairing. Pin WWEBJS_WEB_VERSION to a known-good build and try again.');
            return;
        }
        this.stuckAuthRecoveryAttempted = true;
        const client = this.client;
        this.client = null;
        await this.clearLocalAuth();
        this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        this.callbacks.onDisconnected?.('Saved session could not be restored; cleared for re-pairing');
        if (typeof client?.destroy === 'function')
            void client.destroy().catch(() => undefined);
    }
    async clearLocalAuth() {
        const dir = path.join(path.resolve(this.config.sessionDataPath), `session-${this.config.sessionId}`);
        await fs.promises.rm(dir, { recursive: true, force: true }).catch((error) => {
            this.logger.warn(`Could not clear stale auth at ${dir}`, { error: String(error) });
        });
    }
    async isClientRuntimeReady() {
        if (!this.client)
            return false;
        if ((await this.client.getState()) !== whatsapp_web_js_1.WAState.CONNECTED)
            return false;
        if (!this.client.info?.wid?.user)
            return false;
        const page = this.client.pupPage;
        const hasWWebJS = await page?.evaluate(() => typeof window.WWebJS !== 'undefined');
        return hasWWebJS === true;
    }
    setStatus(status) {
        this.status = status;
        this.callbacks.onStateChanged?.(status);
        this.emit('stateChanged', status);
    }
    beginClientTeardown() {
        const client = this.client;
        if (!client)
            return null;
        this.tearingDown = true;
        this.clearReadyReconcile();
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.DISCONNECTED) {
            this.setStatus(whatsapp_engine_interface_1.EngineStatus.DISCONNECTED);
        }
        return client;
    }
    finishClientTeardown(client) {
        if (this.client === client) {
            this.client = null;
        }
        this.clearReadyReconcile();
    }
    async disconnect() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            await client.destroy();
        }
        catch (error) {
            this.logger.warn('Destroy client failed:', { error: String(error) });
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    async logout() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            await client.logout();
        }
        catch (error) {
            this.logger.warn('Logout failed:', { error: String(error) });
            try {
                await client.destroy();
            }
            catch (destroyError) {
                this.logger.warn('Client destroy also failed during logout fallback', { error: String(destroyError) });
            }
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    async destroy() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            await client.destroy();
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    async forceDestroy() {
        const client = this.beginClientTeardown();
        if (!client)
            return;
        try {
            const proc = client.pupBrowser?.process?.();
            proc?.kill?.('SIGKILL');
        }
        catch (err) {
            this.logger.warn('forceDestroy: failed to kill the browser process', { error: String(err) });
        }
        try {
            await client.destroy();
        }
        catch (err) {
            this.logger.warn('forceDestroy: client.destroy() failed after the kill (continuing)', { error: String(err) });
        }
        finally {
            this.finishClientTeardown(client);
        }
    }
    getStatus() {
        return this.status;
    }
    getQRCode() {
        return this.qrCode;
    }
    async requestPairingCode(phoneNumber) {
        if (!this.client) {
            throw new engine_not_ready_error_1.EngineNotReadyError();
        }
        return this.client.requestPairingCode(phoneNumber);
    }
    getPhoneNumber() {
        return this.phoneNumber;
    }
    getPushName() {
        return this.pushName;
    }
    resolvedSendIds = new Map();
    async resolveSendId(chatId) {
        if (!chatId.endsWith('@c.us')) {
            return chatId;
        }
        const cached = this.resolvedSendIds.get(chatId);
        if (cached) {
            return cached;
        }
        try {
            const wid = await this.getNumberId(chatId);
            if (wid) {
                this.resolvedSendIds.set(chatId, wid);
                if (wid.endsWith('@lid')) {
                    void this.config.lidMappingStore
                        ?.remember((0, wa_id_1.userPart)(wid), (0, wa_id_1.userPart)(chatId), this.config.sessionId)
                        ?.catch(() => { });
                }
                return wid;
            }
            return chatId;
        }
        catch {
            return chatId;
        }
    }
    async sendResolved(chatId, send) {
        const to = await this.resolveSendId(chatId);
        try {
            return await send(to);
        }
        catch (err) {
            if (!chatId.endsWith('@c.us') || !isNoLidForUserError(err)) {
                throw err;
            }
            this.resolvedSendIds.delete(chatId);
            const fresh = await this.resolveSendId(chatId);
            if (fresh === to) {
                throw err;
            }
            return send(fresh);
        }
    }
    async sendTextMessage(chatId, text, mentions) {
        this.ensureReady();
        const msg = await this.sendResolved(chatId, to => mentions?.length ? this.client.sendMessage(to, text, { mentions }) : this.client.sendMessage(to, text));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async sendImageMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }
    async sendVideoMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }
    async sendAudioMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media, media.ptt ? { sendAudioAsVoice: true } : undefined);
    }
    async sendDocumentMessage(chatId, media) {
        return this.sendMediaMessage(chatId, media);
    }
    async sendMediaMessage(chatId, media, extraOptions) {
        this.ensureReady();
        let messageMedia;
        if (typeof media.data === 'string') {
            if (isHttpUrl(media.data)) {
                messageMedia = await loadRemoteMedia(media.data);
            }
            else {
                messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data, media.filename);
            }
        }
        else {
            messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data.toString('base64'), media.filename);
        }
        const msg = await this.sendResolved(chatId, to => this.client.sendMessage(to, messageMedia, {
            caption: media.caption,
            ...(media.mentions?.length ? { mentions: media.mentions } : {}),
            ...extraOptions,
        }));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async getContacts() {
        this.ensureReady();
        const contacts = await this.client.getContacts();
        return contacts.map(c => ({
            id: c.id._serialized,
            name: c.name || undefined,
            pushName: c.pushname || undefined,
            number: c.number,
            isMyContact: c.isMyContact,
            isBlocked: c.isBlocked,
        }));
    }
    async getContactById(contactId) {
        this.ensureReady();
        try {
            const contact = await this.client.getContactById(contactId);
            return {
                id: contact.id._serialized,
                name: contact.name || undefined,
                pushName: contact.pushname || undefined,
                number: contact.number,
                isMyContact: contact.isMyContact,
                isBlocked: contact.isBlocked,
            };
        }
        catch (error) {
            this.logger.warn(`Failed to get contact: ${contactId}`, { error: String(error) });
            return null;
        }
    }
    async getNumberId(number) {
        this.ensureReady();
        const numberId = await this.client.getNumberId(number);
        return numberId?._serialized ?? null;
    }
    async checkNumberExists(number) {
        return (await this.getNumberId(number)) !== null;
    }
    async resolveContactPhone(contactId) {
        this.ensureReady();
        try {
            const [result] = await this.client.getContactLidAndPhone([contactId]);
            const pn = result?.pn;
            return pn ? pn.replace(/@c\.us$/i, '').replace(/\D/g, '') || null : null;
        }
        catch (error) {
            this.logger.debug(`resolveContactPhone failed for ${contactId}`, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async getGroups() {
        this.ensureReady();
        const chats = await this.client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        return groups.map(g => {
            const groupChat = g;
            return {
                id: g.id._serialized,
                name: g.name,
                participantsCount: groupChat.participants?.length,
                isAdmin: groupChat.participants?.some(p => p.isAdmin && p.id._serialized === this.client?.info?.wid?._serialized),
                linkedParentJID: extractLinkedParentJID(groupChat.groupMetadata),
            };
        });
    }
    async sendLocationMessage(chatId, location) {
        this.ensureReady();
        const module = await import('whatsapp-web.js');
        const Location = module.Location || module.default?.Location;
        const loc = new Location(location.latitude, location.longitude, {
            name: location.description || '',
            address: location.address || '',
        });
        const msg = await this.sendResolved(chatId, to => this.client.sendMessage(to, loc));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async sendContactMessage(chatId, contact) {
        this.ensureReady();
        const vcard = (0, vcard_1.buildVCard)(contact);
        const msg = await this.sendResolved(chatId, to => this.client.sendMessage(to, vcard, {
            parseVCards: true,
        }));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async sendStickerMessage(chatId, media) {
        this.ensureReady();
        let messageMedia;
        if (typeof media.data === 'string') {
            if (isHttpUrl(media.data)) {
                messageMedia = await loadRemoteMedia(media.data);
            }
            else {
                messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data, media.filename);
            }
        }
        else {
            messageMedia = new whatsapp_web_js_1.MessageMedia(media.mimetype, media.data.toString('base64'), media.filename);
        }
        const msg = await this.sendResolved(chatId, to => this.client.sendMessage(to, messageMedia, {
            sendMediaAsSticker: true,
        }));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async sendPollMessage(chatId, poll) {
        this.ensureReady();
        const module = await import('whatsapp-web.js');
        const Poll = module.Poll || module.default?.Poll;
        const pollOptions = { allowMultipleAnswers: poll.allowMultipleAnswers === true };
        const msg = await this.sendResolved(chatId, to => this.client.sendMessage(to, new Poll(poll.name, poll.options, pollOptions)));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async replyToMessage(chatId, quotedMsgId, text) {
        this.ensureReady();
        const chat = await this.client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 100 });
        const quotedMsg = messages.find(m => m.id._serialized === quotedMsgId);
        if (!quotedMsg) {
            throw new message_not_found_error_1.MessageNotFoundError(quotedMsgId);
        }
        const msg = await this.sendResolved(chatId, to => quotedMsg.reply(text, to));
        return {
            id: msg.id._serialized,
            timestamp: msg.timestamp,
        };
    }
    async forwardMessage(fromChatId, toChatId, messageId) {
        this.ensureReady();
        const chat = await this.client.getChatById(fromChatId);
        const messages = await chat.fetchMessages({ limit: 100 });
        const msgToForward = messages.find(m => m.id._serialized === messageId);
        if (!msgToForward) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId);
        }
        let resolvedTo = toChatId;
        await this.sendResolved(toChatId, to => {
            resolvedTo = to;
            return msgToForward.forward(to);
        });
        try {
            const destChat = await this.client.getChatById(resolvedTo);
            const sentByMe = (await destChat?.fetchMessages({ limit: 5, fromMe: true })) ?? [];
            let sent;
            for (const m of sentByMe) {
                if (!sent || m.timestamp > sent.timestamp) {
                    sent = m;
                }
            }
            if (sent) {
                return { id: sent.id._serialized, timestamp: sent.timestamp };
            }
        }
        catch (error) {
            this.logger.warn(`Forward succeeded but recovering the sent message id failed: ${String(error)}`);
        }
        return { id: '', timestamp: Math.floor(Date.now() / 1000) };
    }
    async getGroupInfo(groupId) {
        this.ensureReady();
        try {
            const chat = await this.client.getChatById(groupId);
            if (!chat.isGroup) {
                return null;
            }
            const groupChat = chat;
            const participants = (groupChat.participants || []).map(p => ({
                id: String(p.id._serialized),
                number: String(p.id.user),
                name: p.name ? String(p.name) : undefined,
                isAdmin: Boolean(p.isAdmin),
                isSuperAdmin: Boolean(p.isSuperAdmin),
            }));
            return {
                id: chat.id._serialized,
                name: chat.name,
                description: groupChat.description ? String(groupChat.description) : undefined,
                owner: groupChat.owner?._serialized ? String(groupChat.owner._serialized) : undefined,
                createdAt: groupChat.createdAt,
                participants,
                isReadOnly: Boolean(groupChat.isReadOnly),
                isAnnounce: Boolean(groupChat.isAnnounce),
                linkedParentJID: extractLinkedParentJID(groupChat.groupMetadata),
            };
        }
        catch (error) {
            this.logger.warn(`Failed to get group: ${groupId}`, { error: String(error) });
            return null;
        }
    }
    async createGroup(name, participants) {
        this.ensureReady();
        const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
        const result = await this.client.createGroup(name, participantIds);
        const groupId = String(result.gid._serialized);
        return {
            id: groupId,
            name: name,
            participantsCount: participants.length,
        };
    }
    async addParticipants(groupId, participants) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
        await chat.addParticipants(participantIds);
    }
    async removeParticipants(groupId, participants) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
        await chat.removeParticipants(participantIds);
    }
    async promoteParticipants(groupId, participants) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
        await chat.promoteParticipants(participantIds);
    }
    async demoteParticipants(groupId, participants) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
        await chat.demoteParticipants(participantIds);
    }
    async leaveGroup(groupId) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        await chat.leave();
    }
    async setGroupSubject(groupId, subject) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        await chat.setSubject(subject);
    }
    async setGroupDescription(groupId, description) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error('Chat is not a group');
        }
        await chat.setDescription(description);
    }
    async reactToMessage(chatId, messageId, emoji) {
        this.ensureReady();
        const chat = await this.client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find(m => m.id._serialized === messageId);
        if (!message) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId, chatId);
        }
        await message.react(emoji);
        this.logger.log(`Reacted to message ${messageId} with ${emoji || '(removed)'}`);
    }
    async getMessageReactions(chatId, messageId) {
        this.ensureReady();
        const chat = await this.client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find(m => m.id._serialized === messageId);
        if (!message) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId, chatId);
        }
        const msgWithReactions = message;
        if (!msgWithReactions.hasReaction) {
            return [];
        }
        const reactions = await msgWithReactions.getReactions();
        if (!reactions) {
            return [];
        }
        const result = [];
        for (const r of reactions) {
            result.push({
                emoji: String(r.id),
                senders: (r.senders || []).map(s => ({
                    senderId: String(s.senderId),
                    emoji: String(s.reaction),
                    timestamp: Number(s.timestamp),
                })),
            });
        }
        return result;
    }
    async getLabels() {
        this.ensureReady();
        const labels = await this.client.getLabels();
        if (!labels) {
            return [];
        }
        return labels.map(label => ({
            id: String(label.id),
            name: String(label.name),
            hexColor: String(label.hexColor),
        }));
    }
    async getLabelById(labelId) {
        this.ensureReady();
        const label = await this.client.getLabelById(labelId);
        if (!label) {
            return null;
        }
        return {
            id: String(label.id),
            name: String(label.name),
            hexColor: String(label.hexColor),
        };
    }
    async getChatLabels(chatId) {
        this.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return [];
        }
        const chat = await this.client.getChatById(chatId);
        const labels = await chat.getLabels();
        if (!labels) {
            return [];
        }
        return labels.map(label => ({
            id: String(label.id),
            name: String(label.name),
            hexColor: String(label.hexColor),
        }));
    }
    async addLabelToChat(chatId, labelId) {
        this.ensureReady();
        await this.changeChatLabel(chatId, labelId, true);
    }
    async removeLabelFromChat(chatId, labelId) {
        this.ensureReady();
        await this.changeChatLabel(chatId, labelId, false);
    }
    async changeChatLabel(chatId, labelId, add) {
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            throw new chat_labels_unsupported_error_1.ChatLabelsUnsupportedError('Channels do not support chat labels.');
        }
        const ids = new Set((await this.getChatLabels(chatId)).map(label => label.id));
        if (add) {
            ids.add(labelId);
        }
        else {
            ids.delete(labelId);
        }
        try {
            await this.client.addOrRemoveLabels([...ids], [chatId]);
        }
        catch (error) {
            if (String(error instanceof Error ? error.message : error).includes('LT01')) {
                throw new chat_labels_unsupported_error_1.ChatLabelsUnsupportedError();
            }
            throw error;
        }
        this.logger.log(`${add ? 'Added' : 'Removed'} label ${labelId} ${add ? 'to' : 'from'} chat ${chatId}`);
    }
    async getSubscribedChannels() {
        this.ensureReady();
        const channels = await this.client.getChannels();
        if (!channels) {
            return [];
        }
        return channels.map((ch) => ({
            id: String(typeof ch.id === 'object' ? ch.id._serialized : ch.id),
            name: String(ch.name || ''),
            description: ch.description ? String(ch.description) : undefined,
            inviteCode: ch.inviteCode ? String(ch.inviteCode) : undefined,
            subscriberCount: ch.subscriberCount ? Number(ch.subscriberCount) : undefined,
            verified: ch.verified ? Boolean(ch.verified) : undefined,
        }));
    }
    async getChannelById(channelId) {
        this.ensureReady();
        const channels = await this.getSubscribedChannels();
        return channels.find(c => c.id === channelId) ?? null;
    }
    async subscribeToChannel(inviteCode) {
        this.ensureReady();
        const ch = await this.client.subscribeToChannel(inviteCode);
        this.logger.log(`Subscribed to channel with invite code: ${inviteCode}`);
        return {
            id: String(typeof ch.id === 'object' ? ch.id._serialized : ch.id),
            name: String(ch.name || ''),
            description: ch.description ? String(ch.description) : undefined,
        };
    }
    async unsubscribeFromChannel(channelId) {
        this.ensureReady();
        await this.client.unsubscribeFromChannel(channelId);
        this.logger.log(`Unsubscribed from channel: ${channelId}`);
    }
    async getChannelMessages(channelId, limit = 50) {
        this.ensureReady();
        const channels = await this.client.getChannels();
        const channel = channels?.find(c => (typeof c.id === 'object' ? c.id._serialized : c.id) === channelId);
        if (!channel) {
            throw new channel_not_found_error_1.ChannelNotFoundError(channelId);
        }
        const messages = await channel.fetchMessages({ limit });
        return (messages ?? []).map(msg => ({
            id: String(typeof msg.id === 'object' ? msg.id._serialized : msg.id),
            body: String(msg.body || ''),
            timestamp: Number(msg.timestamp),
            hasMedia: Boolean(msg.hasMedia),
            mediaUrl: msg.mediaUrl ? String(msg.mediaUrl) : undefined,
        }));
    }
    async getChatHistory(chatId, limit = 50, includeMedia = false) {
        this.ensureReady();
        const chat = await this.client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });
        const results = [];
        for (const msg of messages) {
            const out = (0, message_mapper_1.buildIncomingMessageBase)(msg);
            out.chatId = chatId;
            out.isGroup = chatId.endsWith('@g.us');
            out.isStatusBroadcast = chatId === 'status@broadcast';
            const call = extractWwebjsCall(msg);
            if (call)
                out.call = call;
            if (msg.type === whatsapp_web_js_1.MessageTypes.LOCATION && msg.location) {
                out.location = {
                    latitude: Number(msg.location.latitude),
                    longitude: Number(msg.location.longitude),
                    description: msg.location.description || undefined,
                    address: msg.location.address || undefined,
                    url: msg.location.url || undefined,
                };
            }
            if (msg.hasQuotedMsg) {
                try {
                    const quoted = await msg.getQuotedMessage();
                    out.quotedMessage = { id: quoted.id._serialized, body: quoted.body };
                }
                catch (error) {
                    this.logger.warn(`Failed to resolve quoted message for ${msg.id._serialized}: ${String(error)}`);
                }
            }
            if (includeMedia && msg.hasMedia) {
                try {
                    const capped = await this.capInboundMediaFor(msg);
                    if (capped)
                        out.media = capped;
                }
                catch (error) {
                    this.logger.warn(`Failed to download media for ${msg.id._serialized}: ${String(error)}`);
                }
            }
            results.push(out);
        }
        return results;
    }
    async deleteMessage(chatId, messageId, forEveryone = true) {
        this.ensureReady();
        const chat = await this.client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find(m => m.id._serialized === messageId || m.id.id === messageId);
        if (!message) {
            throw new message_not_found_error_1.MessageNotFoundError(messageId, chatId);
        }
        await message.delete(forEveryone);
        this.logger.log(`Deleted message ${messageId} from chat ${chatId} (forEveryone: ${forEveryone})`);
    }
    async getProfilePicture(contactId) {
        this.ensureReady();
        try {
            const url = await this.client.getProfilePicUrl(contactId);
            return url || null;
        }
        catch (error) {
            this.logger.warn(`Failed to get profile picture for ${contactId}: ${String(error)}`);
            return null;
        }
    }
    async blockContact(contactId) {
        this.ensureReady();
        const contact = await this.client.getContactById(contactId);
        await contact.block();
        this.logger.log(`Blocked contact ${contactId}`);
    }
    async unblockContact(contactId) {
        this.ensureReady();
        const contact = await this.client.getContactById(contactId);
        await contact.unblock();
        this.logger.log(`Unblocked contact ${contactId}`);
    }
    async getGroupInviteCode(groupId) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error(`${groupId} is not a group`);
        }
        const inviteCode = await chat.getInviteCode();
        this.logger.log(`Got invite code for group ${groupId}`);
        return String(inviteCode);
    }
    async revokeGroupInviteCode(groupId) {
        this.ensureReady();
        const chat = await this.client.getChatById(groupId);
        if (!chat.isGroup) {
            throw new Error(`${groupId} is not a group`);
        }
        const newCode = await chat.revokeInvite();
        this.logger.log(`Revoked invite code for group ${groupId}, new code generated`);
        return String(newCode);
    }
    async getContactStatuses() {
        this.ensureReady();
        this.logger.warn('getContactStatuses not fully implemented in whatsapp-web.js');
        return [];
    }
    async getContactStatus(_contactId) {
        this.ensureReady();
        this.logger.warn('getContactStatus not fully implemented in whatsapp-web.js');
        return [];
    }
    async postTextStatus(_text, _options) {
        this.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('postTextStatus (Baileys-only; wwebjs blocked upstream, see #455)');
    }
    async postImageStatus(_media, _options) {
        this.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('postImageStatus (Baileys-only; wwebjs blocked upstream, see #455)');
    }
    async postVideoStatus(_media, _options) {
        this.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('postVideoStatus (Baileys-only; wwebjs blocked upstream, see #455)');
    }
    async deleteStatus(_statusId) {
        this.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('deleteStatus');
    }
    async getCatalog() {
        this.ensureReady();
        this.logger.warn('getCatalog not implemented in whatsapp-web.js adapter');
        return null;
    }
    async getProducts(_options) {
        this.ensureReady();
        this.logger.warn('getProducts not implemented in whatsapp-web.js adapter');
        return {
            products: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
    }
    async getProduct(_productId) {
        this.ensureReady();
        this.logger.warn('getProduct not implemented in whatsapp-web.js adapter');
        return null;
    }
    async sendProduct(_chatId, _productId, _body) {
        this.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('sendProduct');
    }
    async sendCatalog(_chatId, _body) {
        this.ensureReady();
        throw new engine_not_supported_error_1.EngineNotSupportedError('sendCatalog');
    }
    async getChats() {
        this.ensureReady();
        const chats = await this.client.getChats();
        const summaries = [];
        let skipped = 0;
        for (const chat of chats) {
            const id = chat.id?._serialized;
            if (!id) {
                skipped++;
                continue;
            }
            summaries.push({
                id,
                name: chat.name || id,
                isGroup: Boolean(chat.isGroup),
                unreadCount: chat.unreadCount || 0,
                timestamp: chat.timestamp || 0,
                lastMessage: chat.lastMessage?.type === whatsapp_web_js_1.MessageTypes.LOCATION ? '📍' : chat.lastMessage?.body || undefined,
            });
        }
        if (skipped > 0) {
            this.logger.warn(`Skipped ${skipped} chat(s) without a serialized id`);
        }
        return summaries;
    }
    async sendSeen(chatId) {
        this.ensureReady();
        try {
            const chat = await this.client.getChatById(chatId);
            return await chat.sendSeen();
        }
        catch (error) {
            this.logger.error(`Error marking chat ${chatId} as read`, String(error));
            return false;
        }
    }
    async markUnread(chatId) {
        this.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return false;
        }
        try {
            const chat = await this.client.getChatById(chatId);
            await chat.markUnread();
            return true;
        }
        catch (error) {
            this.logger.error(`Error marking chat ${chatId} as unread`, String(error));
            return false;
        }
    }
    async deleteChat(chatId) {
        this.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return false;
        }
        try {
            const chat = await this.client.getChatById(chatId);
            return await chat.delete();
        }
        catch (error) {
            this.logger.error(`Error deleting chat ${chatId}`, String(error));
            return false;
        }
    }
    async sendChatState(chatId, state) {
        this.ensureReady();
        if ((0, wa_id_1.isChannelJid)(chatId)) {
            return;
        }
        try {
            const to = await this.resolveSendId(chatId);
            const chat = await this.client.getChatById(to);
            if (state === 'typing') {
                await chat.sendStateTyping();
            }
            else if (state === 'recording') {
                await chat.sendStateRecording();
            }
            else {
                await chat.clearState();
            }
        }
        catch (error) {
            this.logger.warn(`Could not set chat state '${state}' for ${chatId} (best-effort)`, { error: String(error) });
        }
    }
    ensureReady() {
        if (this.status !== whatsapp_engine_interface_1.EngineStatus.READY || !this.client) {
            throw new engine_not_ready_error_1.EngineNotReadyError();
        }
    }
}
exports.WhatsAppWebJsAdapter = WhatsAppWebJsAdapter;
//# sourceMappingURL=whatsapp-web-js.adapter.js.map