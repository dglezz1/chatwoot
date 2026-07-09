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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const message_service_1 = require("./message.service");
const bulk_message_service_1 = require("./bulk-message.service");
const dto_1 = require("./dto");
const send_template_dto_1 = require("./dto/send-template.dto");
const bulk_message_dto_1 = require("./dto/bulk-message.dto");
const message_actions_dto_1 = require("./dto/message-actions.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let MessageController = class MessageController {
    messageService;
    bulkMessageService;
    constructor(messageService, bulkMessageService) {
        this.messageService = messageService;
        this.bulkMessageService = bulkMessageService;
    }
    async getMessages(sessionId, chatId, from, limit, offset) {
        return this.messageService.getMessages(sessionId, {
            chatId,
            from,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async sendText(sessionId, dto) {
        return this.messageService.sendText(sessionId, dto);
    }
    async sendTemplate(sessionId, dto) {
        return this.messageService.sendTemplate(sessionId, dto);
    }
    async sendImage(sessionId, dto) {
        return this.messageService.sendImage(sessionId, dto);
    }
    async sendVideo(sessionId, dto) {
        return this.messageService.sendVideo(sessionId, dto);
    }
    async sendAudio(sessionId, dto) {
        return this.messageService.sendAudio(sessionId, dto);
    }
    async sendDocument(sessionId, dto) {
        return this.messageService.sendDocument(sessionId, dto);
    }
    async sendLocation(sessionId, dto) {
        return this.messageService.sendLocation(sessionId, dto);
    }
    async sendContact(sessionId, dto) {
        return this.messageService.sendContact(sessionId, dto);
    }
    async sendSticker(sessionId, dto) {
        return this.messageService.sendSticker(sessionId, dto);
    }
    async sendPoll(sessionId, dto) {
        return this.messageService.sendPoll(sessionId, dto);
    }
    async reply(sessionId, dto) {
        return this.messageService.reply(sessionId, dto);
    }
    async forward(sessionId, dto) {
        return this.messageService.forward(sessionId, dto);
    }
    async react(sessionId, dto) {
        await this.messageService.reactToMessage(sessionId, dto);
        return { success: true };
    }
    async getChatHistory(sessionId, chatId, limit, includeMedia, deep) {
        const parsedLimit = limit ? parseInt(limit, 10) : undefined;
        return this.messageService.getChatHistory(sessionId, chatId, parsedLimit !== undefined && !Number.isNaN(parsedLimit) ? parsedLimit : undefined, includeMedia === 'true' || includeMedia === '1', deep === 'true' || deep === '1');
    }
    async getReactions(sessionId, chatId, messageId) {
        return this.messageService.getMessageReactions(sessionId, chatId, messageId);
    }
    async deleteMessage(sessionId, dto) {
        await this.messageService.deleteMessage(sessionId, dto);
        return { success: true };
    }
    async sendBulk(sessionId, dto) {
        const batch = await this.bulkMessageService.createBatch(sessionId, dto);
        const estimatedTime = new Date(Date.now() + batch.messages.length * (batch.options?.delayBetweenMessages || 3000));
        return {
            batchId: batch.batchId,
            status: batch.status,
            totalMessages: batch.messages.length,
            estimatedCompletionTime: estimatedTime.toISOString(),
            statusUrl: `/api/sessions/${sessionId}/messages/batch/${batch.batchId}`,
        };
    }
    async getBatchStatus(sessionId, batchId) {
        const batch = await this.bulkMessageService.getBatchStatus(sessionId, batchId);
        return {
            batchId: batch.batchId,
            status: batch.status,
            progress: batch.progress,
            results: batch.results,
            startedAt: batch.startedAt,
            completedAt: batch.completedAt,
        };
    }
    async cancelBatch(sessionId, batchId) {
        const batch = await this.bulkMessageService.cancelBatch(sessionId, batchId);
        return {
            batchId: batch.batchId,
            status: batch.status,
            progress: batch.progress,
        };
    }
};
exports.MessageController = MessageController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get message history for a session' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiQuery)({ name: 'chatId', required: false, description: 'Filter by chat ID' }),
    (0, swagger_1.ApiQuery)({
        name: 'from',
        required: false,
        description: 'Filter by sender. A phone also matches messages from a lid that resolves to it.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max messages to return (default 50)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Message history',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Query)('chatId')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('send-text'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a text message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Message sent',
        type: dto_1.MessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendTextMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendText", null);
__decorate([
    (0, common_1.Post)('send-template'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Render a stored text template and send it as a text message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Template rendered and sent',
        type: dto_1.MessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session or template not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_template_dto_1.SendTemplateMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendTemplate", null);
__decorate([
    (0, common_1.Post)('send-image'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send an image message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Image sent',
        type: dto_1.MessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendMediaMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendImage", null);
__decorate([
    (0, common_1.Post)('send-video'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a video message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Video sent',
        type: dto_1.MessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendMediaMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendVideo", null);
__decorate([
    (0, common_1.Post)('send-audio'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send an audio/voice message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Audio sent',
        type: dto_1.MessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendAudioMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendAudio", null);
__decorate([
    (0, common_1.Post)('send-document'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a document/file' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Document sent',
        type: dto_1.MessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendMediaMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendDocument", null);
__decorate([
    (0, common_1.Post)('send-location'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a location message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Location sent',
        type: dto_1.MessageResponseDto,
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.SendLocationDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendLocation", null);
__decorate([
    (0, common_1.Post)('send-contact'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a contact card message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Contact sent',
        type: dto_1.MessageResponseDto,
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.SendContactDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendContact", null);
__decorate([
    (0, common_1.Post)('send-sticker'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a sticker message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Sticker sent',
        type: dto_1.MessageResponseDto,
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendMediaMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendSticker", null);
__decorate([
    (0, common_1.Post)('send-poll'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Send a native WhatsApp poll' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Poll sent',
        type: dto_1.MessageResponseDto,
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.SendPollDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendPoll", null);
__decorate([
    (0, common_1.Post)('reply'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Reply to a message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Reply sent',
        type: dto_1.MessageResponseDto,
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.ReplyMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "reply", null);
__decorate([
    (0, common_1.Post)('forward'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Forward a message to another chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Message forwarded',
        type: dto_1.MessageResponseDto,
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.ForwardMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "forward", null);
__decorate([
    (0, common_1.Post)('react'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Add or remove a reaction to a message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Reaction added or removed. Send empty emoji to remove reaction.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or message not found',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.ReactMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "react", null);
__decorate([
    (0, common_1.Get)(':chatId/history'),
    (0, swagger_1.ApiOperation)({
        summary: 'Fetch chat history live from WhatsApp',
        description: 'Reads messages directly from the WhatsApp client for the given chat, bypassing the local DB. ' +
            'Useful for retrieving messages that arrived before the gateway was started.',
    }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID (e.g. 1234567890@c.us or groupId@g.us)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max messages to return (default 50)' }),
    (0, swagger_1.ApiQuery)({
        name: 'includeMedia',
        required: false,
        type: Boolean,
        description: 'When true, downloads media (base64) for messages that have it. Slower; default false.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'deep',
        required: false,
        type: Boolean,
        description: 'When true, raises the limit ceiling from 100 to 2000 for reaching further back in history ' +
            '(whatsapp-web.js only; loads earlier messages on demand). Forces metadata-only (includeMedia ' +
            'is ignored). Large/slow requests may increase WhatsApp rate-limiting risk; default false.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat history (most recent messages)' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('includeMedia')),
    __param(4, (0, common_1.Query)('deep')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "getChatHistory", null);
__decorate([
    (0, common_1.Get)(':chatId/:messageId/reactions'),
    (0, swagger_1.ApiOperation)({ summary: 'Get reactions for a specific message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID containing the message' }),
    (0, swagger_1.ApiParam)({ name: 'messageId', description: 'Message ID to get reactions for' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of reactions with senders',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __param(2, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "getReactions", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a message' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Message deleted',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or message not found',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, message_actions_dto_1.DeleteMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "deleteMessage", null);
__decorate([
    (0, common_1.Post)('send-bulk'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'Send messages to multiple recipients (async batch processing)' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 202,
        description: 'Batch created and processing started',
        type: bulk_message_dto_1.BulkMessageResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Session not active or invalid request',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bulk_message_dto_1.SendBulkMessageDto]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "sendBulk", null);
__decorate([
    (0, common_1.Get)('batch/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get batch processing status' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'batchId', description: 'Batch ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Batch status and progress',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Batch not found',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "getBatchStatus", null);
__decorate([
    (0, common_1.Post)('batch/:batchId/cancel'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a running batch' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'batchId', description: 'Batch ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Batch cancelled',
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Batch already completed or cancelled',
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Batch not found',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessageController.prototype, "cancelBatch", null);
exports.MessageController = MessageController = __decorate([
    (0, swagger_1.ApiTags)('messages'),
    (0, common_1.Controller)('sessions/:sessionId/messages'),
    __metadata("design:paramtypes", [message_service_1.MessageService,
        bulk_message_service_1.BulkMessageService])
], MessageController);
//# sourceMappingURL=message.controller.js.map