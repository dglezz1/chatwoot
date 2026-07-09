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
exports.SessionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const session_service_1 = require("./session.service");
const dto_1 = require("./dto");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let SessionController = class SessionController {
    sessionService;
    auditService;
    constructor(sessionService, auditService) {
        this.sessionService = sessionService;
        this.auditService = auditService;
    }
    transformSession(session) {
        return dto_1.SessionResponseDto.fromEntity(session);
    }
    async create(dto) {
        const session = await this.sessionService.create(dto);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_CREATED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return session;
    }
    async findAll(apiKey, limit, offset) {
        const sessions = await this.sessionService.findAll(apiKey?.allowedSessions, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return sessions.map(s => this.transformSession(s));
    }
    async findOne(id) {
        const session = await this.sessionService.findOne(id);
        return this.transformSession(session);
    }
    async delete(id) {
        const session = await this.sessionService.findOne(id);
        await this.sessionService.delete(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_DELETED, {
            sessionId: id,
            sessionName: session.name,
        });
    }
    async start(id) {
        const session = await this.sessionService.start(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_STARTED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async stop(id) {
        const session = await this.sessionService.stop(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_STOPPED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async forceKill(id) {
        const session = await this.sessionService.forceKill(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_FORCE_KILLED, {
            sessionId: session.id,
            sessionName: session.name,
        });
        return this.transformSession(session);
    }
    async getQRCode(id) {
        const qrCode = await this.sessionService.getQRCode(id);
        await this.auditService.logInfo(audit_log_entity_1.AuditAction.SESSION_QR_GENERATED, {
            sessionId: id,
        });
        return qrCode;
    }
    async requestPairingCode(id, dto) {
        return this.sessionService.requestPairingCode(id, dto.phoneNumber);
    }
    async getGroups(id, limit, offset) {
        return this.sessionService.getGroups(id, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async getChats(id, limit, offset) {
        return this.sessionService.getChats(id, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async markChatRead(id, dto) {
        const success = await this.sessionService.sendSeen(id, dto.chatId);
        return { success };
    }
    async markChatUnread(id, dto) {
        const success = await this.sessionService.markUnread(id, dto.chatId);
        return { success };
    }
    async deleteChat(id, dto) {
        const success = await this.sessionService.deleteChat(id, dto.chatId);
        return { success };
    }
    async sendChatState(id, dto) {
        await this.sessionService.sendChatState(id, dto.chatId, dto.state);
        return { success: true };
    }
    async getStats(apiKey) {
        return this.sessionService.getStats(apiKey?.allowedSessions);
    }
};
exports.SessionController = SessionController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new WhatsApp session' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Session created',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Session name already exists' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateSessionDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all sessions' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of sessions',
        type: [dto_1.SessionResponseDto],
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max sessions to return (1-1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of sessions to skip (for paging)' }),
    __param(0, (0, auth_decorators_1.CurrentApiKey)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_key_entity_1.ApiKey, String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get session by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session details',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Session deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({
        summary: 'Start a session and initialize WhatsApp connection',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session started',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session already started' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/stop'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Stop a session and disconnect WhatsApp' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session stopped',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)(':id/force-kill'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Force-kill a stuck session (SIGKILL its wedged engine, then tear it down)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session force-killed',
        type: dto_1.SessionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "forceKill", null);
__decorate([
    (0, common_1.Get)(':id/qr'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Get QR code for session authentication' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'QR code data',
        type: dto_1.QRCodeResponseDto,
    }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'QR code not ready or session already authenticated',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getQRCode", null);
__decorate([
    (0, common_1.Post)(':id/pairing-code'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Request an 8-char pairing code to link via phone number (alternative to QR)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Pairing code generated', type: dto_1.PairingCodeResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not started or already authenticated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.RequestPairingCodeDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "requestPairingCode", null);
__decorate([
    (0, common_1.Get)(':id/groups'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all groups for a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of groups the session is a member of',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max groups to return (1–1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of groups to skip (for paging)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getGroups", null);
__decorate([
    (0, common_1.Get)(':id/chats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get active chats for a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of active chats (most recent first)' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max chats to return (1–1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of chats to skip (for paging)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getChats", null);
__decorate([
    (0, common_1.Post)(':id/chats/read'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Mark a chat as read/seen' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat marked as read successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.MarkChatReadDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "markChatRead", null);
__decorate([
    (0, common_1.Post)(':id/chats/unread'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Mark a chat as unread' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat marked as unread successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.MarkChatReadDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "markChatUnread", null);
__decorate([
    (0, common_1.Post)(':id/chats/delete'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a chat from the chat list (e.g. a group you have left)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Chat deleted successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.DeleteChatDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "deleteChat", null);
__decorate([
    (0, common_1.Post)(':id/chats/typing'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: "Send a typing/recording presence indicator to a chat (or clear it with 'paused')" }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Presence sent' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.SendChatStateDto]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "sendChatState", null);
__decorate([
    (0, common_1.Get)('stats/overview'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get session statistics for multi-session monitoring',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Session statistics including counts and memory usage',
    }),
    __param(0, (0, auth_decorators_1.CurrentApiKey)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_key_entity_1.ApiKey]),
    __metadata("design:returntype", Promise)
], SessionController.prototype, "getStats", null);
exports.SessionController = SessionController = __decorate([
    (0, swagger_1.ApiTags)('sessions'),
    (0, common_1.Controller)('sessions'),
    (0, auth_decorators_1.SessionScoped)(),
    __metadata("design:paramtypes", [session_service_1.SessionService,
        audit_service_1.AuditService])
], SessionController);
//# sourceMappingURL=session.controller.js.map