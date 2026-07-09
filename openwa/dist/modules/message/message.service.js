"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_service_1 = require("../session/session.service");
const media_cap_util_1 = require("./media-cap.util");
const message_entity_1 = require("./entities/message.entity");
const hooks_1 = require("../../core/hooks");
const template_service_1 = require("../template/template.service");
const template_render_1 = require("../../common/utils/template-render");
const logger_service_1 = require("../../common/services/logger.service");
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const wa_id_1 = require("../../engine/identity/wa-id");
const feature_flags_1 = require("../../config/feature-flags");
const lid_mapping_store_service_1 = require("../../engine/identity/lid-mapping-store.service");
let MessageService = class MessageService {
    static { MessageService_1 = this; }
    messageRepository;
    sessionService;
    hookManager;
    templateService;
    lidMappingStore;
    configService;
    logger = (0, logger_service_1.createLogger)('MessageService');
    constructor(messageRepository, sessionService, hookManager, templateService, lidMappingStore, configService) {
        this.messageRepository = messageRepository;
        this.sessionService = sessionService;
        this.hookManager = hookManager;
        this.templateService = templateService;
        this.lidMappingStore = lidMappingStore;
        this.configService = configService;
    }
    async sendText(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'text', dto);
        const engine = this.getEngine(sessionId);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: finalDto.text,
            type: 'text',
        });
        await this.simulateTypingIfEnabled(engine, finalDto.chatId, finalDto.text);
        let result;
        try {
            result = finalDto.mentions?.length
                ? await engine.sendTextMessage(finalDto.chatId, finalDto.text, finalDto.mentions)
                : await engine.sendTextMessage(finalDto.chatId, finalDto.text);
        }
        catch (error) {
            return this.failSend(sessionId, 'text', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async applySendingGate(sessionId, type, input) {
        const { continue: shouldContinue, data: hookData } = await this.hookManager.execute('message:sending', { sessionId, input, type }, { sessionId, source: 'MessageService' });
        if (!shouldContinue) {
            throw new common_1.BadRequestException('Message sending blocked by plugin');
        }
        return hookData.input;
    }
    async failSend(sessionId, type, message, input, error) {
        await this.saveFailedMessage(message);
        const hookError = error instanceof ssrf_guard_1.SsrfBlockedError
            ? ssrf_guard_1.SSRF_BLOCKED_CLIENT_MESSAGE
            : error instanceof Error
                ? error.message
                : String(error);
        await this.hookManager.execute('message:failed', { sessionId, error: hookError, input, type }, { sessionId, source: 'MessageService' });
        throw this.toClientFacingError(error);
    }
    async sendTemplate(sessionId, dto) {
        const template = await this.templateService.resolve(sessionId, {
            templateId: dto.templateId,
            templateName: dto.templateName,
        });
        const vars = dto.vars ?? {};
        const segments = [template.header, template.body, template.footer]
            .filter((segment) => segment != null && segment.length > 0)
            .map(segment => (0, template_render_1.renderTemplate)(segment, vars));
        const text = segments.join('\n\n');
        return this.sendText(sessionId, { chatId: dto.chatId, text });
    }
    async sendImage(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'image', dto);
        const engine = this.getEngine(sessionId);
        const media = this.buildMediaInput(finalDto);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: finalDto.caption || '',
            type: 'image',
            metadata: {
                media: { mimetype: finalDto.mimetype, filename: finalDto.filename, data: finalDto.base64 || finalDto.url },
            },
        });
        let result;
        try {
            result = await engine.sendImageMessage(finalDto.chatId, media);
        }
        catch (error) {
            return this.failSend(sessionId, 'image', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async sendVideo(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'video', dto);
        const engine = this.getEngine(sessionId);
        const media = this.buildMediaInput(finalDto);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: finalDto.caption || '',
            type: 'video',
            metadata: {
                media: { mimetype: finalDto.mimetype, filename: finalDto.filename, data: finalDto.base64 || finalDto.url },
            },
        });
        let result;
        try {
            result = await engine.sendVideoMessage(finalDto.chatId, media);
        }
        catch (error) {
            return this.failSend(sessionId, 'video', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async sendAudio(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, dto.ptt ? 'voice' : 'audio', dto);
        const engine = this.getEngine(sessionId);
        const audioDto = finalDto.ptt && !finalDto.mimetype ? { ...finalDto, mimetype: 'audio/ogg; codecs=opus' } : finalDto;
        const media = this.buildMediaInput(audioDto);
        media.ptt = finalDto.ptt;
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            type: finalDto.ptt ? 'voice' : 'audio',
            metadata: {
                media: { mimetype: audioDto.mimetype, filename: finalDto.filename, data: finalDto.base64 || finalDto.url },
            },
        });
        let result;
        try {
            result = await engine.sendAudioMessage(finalDto.chatId, media);
        }
        catch (error) {
            return this.failSend(sessionId, finalDto.ptt ? 'voice' : 'audio', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async sendDocument(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'document', dto);
        const engine = this.getEngine(sessionId);
        const media = this.buildMediaInput(finalDto);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: finalDto.caption || finalDto.filename || '',
            type: 'document',
            metadata: {
                media: { mimetype: finalDto.mimetype, filename: finalDto.filename, data: finalDto.base64 || finalDto.url },
            },
        });
        let result;
        try {
            result = await engine.sendDocumentMessage(finalDto.chatId, media);
        }
        catch (error) {
            return this.failSend(sessionId, 'document', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async getMessages(sessionId, options = {}) {
        const { chatId, from } = options;
        const rawLimit = options.limit;
        const rawOffset = options.offset;
        const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;
        const offset = typeof rawOffset === 'number' && Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;
        const query = this.messageRepository
            .createQueryBuilder('message')
            .where('message.sessionId = :sessionId', { sessionId })
            .orderBy('message.createdAt', 'DESC')
            .skip(offset)
            .take(limit);
        if (chatId) {
            query.andWhere('message.chatId IN (:...chatIds)', { chatIds: this.resolveJidCandidates(chatId) });
        }
        if (from) {
            query.andWhere('message.from IN (:...froms)', { froms: this.resolveJidCandidates(from) });
        }
        const [messages, total] = await query.getManyAndCount();
        return { messages, total };
    }
    resolveJidCandidates(value) {
        const phone = (0, wa_id_1.userPart)(value);
        const candidates = new Set([value, `${phone}@c.us`, `${phone}@s.whatsapp.net`]);
        for (const lid of this.lidMappingStore.lidsForPhone(phone)) {
            candidates.add(`${lid}@lid`);
        }
        return [...candidates];
    }
    async sendLocation(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'location', dto);
        const engine = this.getEngine(sessionId);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: `📍 ${finalDto.description || 'Location'}`,
            type: 'location',
        });
        let result;
        try {
            result = await engine.sendLocationMessage(finalDto.chatId, {
                latitude: finalDto.latitude,
                longitude: finalDto.longitude,
                description: finalDto.description,
                address: finalDto.address,
            });
        }
        catch (error) {
            return this.failSend(sessionId, 'location', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async sendContact(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'contact', dto);
        const engine = this.getEngine(sessionId);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: `📇 ${finalDto.contactName}`,
            type: 'contact',
        });
        let result;
        try {
            result = await engine.sendContactMessage(finalDto.chatId, {
                name: finalDto.contactName,
                number: finalDto.contactNumber,
            });
        }
        catch (error) {
            return this.failSend(sessionId, 'contact', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async sendPoll(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'poll', dto);
        const engine = this.getEngine(sessionId);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: `📊 ${finalDto.name}`,
            type: 'poll',
        });
        let result;
        try {
            result = await engine.sendPollMessage(finalDto.chatId, {
                name: finalDto.name,
                options: finalDto.options,
                allowMultipleAnswers: finalDto.allowMultipleAnswers === true,
            });
        }
        catch (error) {
            return this.failSend(sessionId, 'poll', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async sendSticker(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'sticker', dto);
        const engine = this.getEngine(sessionId);
        const media = this.buildMediaInput(finalDto);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            type: 'sticker',
            metadata: {
                media: { mimetype: finalDto.mimetype, filename: finalDto.filename, data: finalDto.base64 || finalDto.url },
            },
        });
        let result;
        try {
            result = await engine.sendStickerMessage(finalDto.chatId, media);
        }
        catch (error) {
            return this.failSend(sessionId, 'sticker', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async reply(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'reply', dto);
        const engine = this.getEngine(sessionId);
        let quotedBody = '';
        try {
            const quoted = await this.messageRepository.findOne({
                where: { sessionId, waMessageId: finalDto.quotedMessageId },
            });
            quotedBody = quoted?.body || '';
        }
        catch (err) {
            this.logger.warn(`Failed to resolve quoted message ${finalDto.quotedMessageId}`, { error: String(err) });
        }
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.chatId,
            body: finalDto.text,
            type: 'text',
            metadata: {
                quotedMessage: { id: finalDto.quotedMessageId, body: quotedBody },
            },
        });
        let result;
        try {
            result = await engine.replyToMessage(finalDto.chatId, finalDto.quotedMessageId, finalDto.text);
        }
        catch (error) {
            return this.failSend(sessionId, 'reply', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async forward(sessionId, dto) {
        const finalDto = await this.applySendingGate(sessionId, 'forward', dto);
        const engine = this.getEngine(sessionId);
        const message = await this.saveOutgoingMessage(sessionId, {
            chatId: finalDto.toChatId,
            body: '[Forwarded]',
            type: 'forward',
        });
        let result;
        try {
            result = await engine.forwardMessage(finalDto.fromChatId, finalDto.toChatId, finalDto.messageId);
        }
        catch (error) {
            return this.failSend(sessionId, 'forward', message, finalDto, error);
        }
        return this.persistSentState(message, result);
    }
    async saveIncomingMessage(sessionId, data) {
        const message = this.messageRepository.create({
            ...data,
            sessionId,
            direction: message_entity_1.MessageDirection.INCOMING,
        });
        return this.messageRepository.save(message);
    }
    async saveOutgoingMessage(sessionId, data) {
        const session = await this.sessionService.findOne(sessionId);
        const message = this.messageRepository.create({
            sessionId,
            waMessageId: data.waMessageId,
            chatId: data.chatId,
            from: session?.phone || 'me',
            to: data.chatId,
            body: data.body,
            type: data.type,
            direction: message_entity_1.MessageDirection.OUTGOING,
            timestamp: data.timestamp,
            status: data.status ?? message_entity_1.MessageStatus.PENDING,
            metadata: data.metadata,
        });
        const saved = await this.messageRepository.save(message);
        void this.hookManager
            .execute('message:persisted', { sessionId, message: saved }, { sessionId, source: 'MessageService' })
            .catch(() => undefined);
        return saved;
    }
    async saveFailedMessage(message) {
        const media = message.metadata?.media;
        if (media) {
            delete media.data;
        }
        message.status = message_entity_1.MessageStatus.FAILED;
        await this.messageRepository.save(message);
    }
    async persistSentState(message, result) {
        if (result.id)
            message.waMessageId = result.id;
        message.status = message_entity_1.MessageStatus.SENT;
        message.timestamp = result.timestamp;
        try {
            await this.messageRepository.save(message);
        }
        catch (persistError) {
            this.logger.warn(`Persisting SENT state failed after a successful send (id=${result.id})`, {
                error: persistError instanceof Error ? persistError.message : String(persistError),
            });
        }
        return { messageId: result.id, timestamp: result.timestamp };
    }
    async reactToMessage(sessionId, dto) {
        const engine = this.getEngine(sessionId);
        await engine.reactToMessage(dto.chatId, dto.messageId, dto.emoji);
    }
    async getMessageReactions(sessionId, chatId, messageId) {
        const engine = this.getEngine(sessionId);
        return engine.getMessageReactions(chatId, messageId);
    }
    static MAX_CHAT_HISTORY_LIMIT = 100;
    static MAX_DEEP_CHAT_HISTORY_LIMIT = 2000;
    async getChatHistory(sessionId, chatId, limit = 50, includeMedia = false, deep = false) {
        const engine = this.getEngine(sessionId);
        const ceiling = deep ? MessageService_1.MAX_DEEP_CHAT_HISTORY_LIMIT : MessageService_1.MAX_CHAT_HISTORY_LIMIT;
        const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), ceiling) : 50;
        return engine.getChatHistory(chatId, safeLimit, deep ? false : includeMedia);
    }
    async deleteMessage(sessionId, dto) {
        const engine = this.getEngine(sessionId);
        await engine.deleteMessage(dto.chatId, dto.messageId, dto.forEveryone ?? true);
        try {
            await this.messageRepository.update({ sessionId, waMessageId: dto.messageId }, { body: '', type: 'revoked' });
        }
        catch (err) {
            this.logger.warn(`Failed to flag deleted message ${dto.messageId} as revoked`, { error: String(err) });
        }
    }
    getEngine(sessionId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.BadRequestException(`Session '${sessionId}' is not active. Start the session first.`);
        }
        return engine;
    }
    async simulateTypingIfEnabled(engine, chatId, text) {
        const { simulateTyping, simulateTypingMaxMs } = (0, feature_flags_1.resolveFeatureFlags)(this.configService);
        if (!simulateTyping)
            return;
        try {
            await engine.sendChatState(chatId, 'typing');
            const maxMs = simulateTypingMaxMs;
            const planned = Math.min(maxMs, 500 + text.length * 45);
            const jittered = Math.round(planned * (0.85 + Math.random() * 0.3));
            await new Promise(resolve => setTimeout(resolve, jittered));
        }
        catch (error) {
            this.logger.warn(`simulateTyping skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    toClientFacingError(error) {
        if (error instanceof ssrf_guard_1.SsrfBlockedError) {
            this.logger.warn(`Outbound media fetch blocked by SSRF guard: ${error.message}`);
            return new common_1.BadRequestException(ssrf_guard_1.SSRF_BLOCKED_CLIENT_MESSAGE);
        }
        return error;
    }
    buildMediaInput(dto) {
        if (!dto.url && !dto.base64) {
            throw new common_1.BadRequestException('Either url or base64 must be provided');
        }
        if (dto.base64 && !dto.mimetype) {
            throw new common_1.BadRequestException('mimetype is required when using base64 data');
        }
        (0, media_cap_util_1.assertBase64WithinMediaCap)(dto.base64);
        return {
            mimetype: dto.mimetype || 'application/octet-stream',
            data: dto.url || dto.base64,
            filename: dto.filename,
            caption: dto.caption,
            mentions: dto.mentions,
        };
    }
};
exports.MessageService = MessageService;
exports.MessageService = MessageService = MessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'data')),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        session_service_1.SessionService,
        hooks_1.HookManager,
        template_service_1.TemplateService,
        lid_mapping_store_service_1.LidMappingStoreService,
        config_1.ConfigService])
], MessageService);
//# sourceMappingURL=message.service.js.map