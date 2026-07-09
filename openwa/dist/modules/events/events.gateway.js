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
exports.EventsGateway = void 0;
exports.isSessionSubscriptionAllowed = isSessionSubscriptionAllowed;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const bootstrap_security_1 = require("../../config/bootstrap-security");
function resolveWsCorsOrigin() {
    const policy = (0, bootstrap_security_1.resolveCorsPolicy)(process.env.CORS_ORIGINS, process.env.NODE_ENV);
    return policy.allowAnyOrigin ? true : policy.origins;
}
const ws_messages_dto_1 = require("./dto/ws-messages.dto");
function isSessionSubscriptionAllowed(allowedSessions, sessionId) {
    if (!allowedSessions || allowedSessions.length === 0) {
        return true;
    }
    if (sessionId === '*') {
        return false;
    }
    return allowedSessions.includes(sessionId);
}
let EventsGateway = class EventsGateway {
    authService;
    auditService;
    server;
    logger = new common_1.Logger('EventsGateway');
    constructor(authService, auditService) {
        this.authService = authService;
        this.auditService = auditService;
    }
    afterInit() {
        this.logger.log('WebSocket Gateway initialized');
    }
    async handleConnection(client) {
        const handshakeAuth = client.handshake.auth;
        const apiKey = handshakeAuth?.apiKey || client.handshake.headers['x-api-key'];
        if (!apiKey) {
            this.logger.warn(`Client ${client.id} rejected: No API key provided`);
            void this.auditService.logWarn(audit_log_entity_1.AuditAction.API_KEY_AUTH_FAILED, {
                ipAddress: client.handshake.address,
                metadata: { surface: 'websocket' },
                errorMessage: 'missing API key',
            });
            client.emit('message', this.createError('UNAUTHORIZED', 'API key required'));
            client.disconnect();
            return;
        }
        try {
            const validKey = await this.authService.validateApiKey(apiKey);
            client.data.apiKey = validKey;
            client.data.rawApiKey = apiKey;
            this.logger.log(`Client connected: ${client.id} (key: ${validKey.name})`);
        }
        catch (error) {
            this.logger.warn(`Client ${client.id} rejected: Auth error`, {
                error: error instanceof Error ? error.message : String(error),
            });
            void this.auditService.logWarn(audit_log_entity_1.AuditAction.API_KEY_AUTH_FAILED, {
                ipAddress: client.handshake.address,
                metadata: { surface: 'websocket' },
                errorMessage: error instanceof Error ? error.message : String(error),
            });
            client.emit('message', this.createError('UNAUTHORIZED', 'Authentication failed'));
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleMessage(client, message) {
        switch (message.type) {
            case 'subscribe':
                return this.handleSubscribe(client, message);
            case 'unsubscribe':
                return this.handleUnsubscribe(client, message);
            case 'ping':
                return this.handlePing(client, message.requestId);
            default:
                return this.createError('INVALID_MESSAGE', `Unknown message type`, message.requestId);
        }
    }
    async handleSubscribe(client, message) {
        const { sessionId, events, requestId } = message;
        if (!sessionId || typeof sessionId !== 'string') {
            return this.createError('INVALID_SESSION', 'sessionId is required', requestId);
        }
        const rawApiKey = client.data.rawApiKey;
        let subscriberKey;
        try {
            subscriberKey = rawApiKey ? await this.authService.validateApiKey(rawApiKey) : null;
        }
        catch {
            subscriberKey = null;
        }
        if (!subscriberKey) {
            client.emit('message', this.createError('UNAUTHORIZED', 'API key is no longer valid', requestId));
            client.disconnect();
            return this.createError('UNAUTHORIZED', 'API key is no longer valid', requestId);
        }
        if (!isSessionSubscriptionAllowed(subscriberKey.allowedSessions, sessionId)) {
            return this.createError('FORBIDDEN_SESSION', 'API key is not authorized for this session', requestId);
        }
        if (!events || !Array.isArray(events) || events.length === 0) {
            return this.createError('INVALID_EVENTS', 'events array is required', requestId);
        }
        const validEvents = events.filter(e => e === '*' || ws_messages_dto_1.SUBSCRIBABLE_EVENTS.includes(e));
        if (validEvents.length === 0) {
            return this.createError('INVALID_EVENTS', `No valid events. Valid: ${ws_messages_dto_1.SUBSCRIBABLE_EVENTS.join(', ')}, *`, requestId);
        }
        const rooms = [];
        for (const event of validEvents) {
            const room = (0, ws_messages_dto_1.buildRoomName)(sessionId, event);
            void client.join(room);
            rooms.push(room);
        }
        this.logger.debug(`Client ${client.id} subscribed to: ${rooms.join(', ')}`);
        return {
            type: 'subscribed',
            sessionId,
            events: validEvents,
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    handleUnsubscribe(client, message) {
        const { sessionId, requestId } = message;
        const clientRooms = Array.from(client.rooms);
        const sessionPrefix = `session:${sessionId}:`;
        for (const room of clientRooms) {
            if (room.startsWith(sessionPrefix) || (sessionId === '*' && room.startsWith('session:'))) {
                void client.leave(room);
            }
        }
        this.logger.debug(`Client ${client.id} unsubscribed from session: ${sessionId}`);
        return {
            type: 'unsubscribed',
            sessionId,
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    handlePing(_client, requestId) {
        return {
            type: 'pong',
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    createError(code, message, requestId) {
        return {
            type: 'error',
            code,
            message,
            requestId,
            timestamp: new Date().toISOString(),
        };
    }
    emitToRooms(sessionId, event, data) {
        const eventMessage = {
            type: 'event',
            payload: { event, sessionId, data },
            timestamp: new Date().toISOString(),
        };
        this.server
            .to((0, ws_messages_dto_1.buildRoomName)(sessionId, event))
            .to((0, ws_messages_dto_1.buildRoomName)(sessionId, '*'))
            .to((0, ws_messages_dto_1.buildRoomName)('*', event))
            .to((0, ws_messages_dto_1.buildRoomName)('*', '*'))
            .emit('message', eventMessage);
    }
    emitSessionStatus(sessionId, status, data) {
        this.emitToRooms(sessionId, 'session.status', { status, ...data });
    }
    emitSessionAuthenticated(sessionId, data) {
        this.emitToRooms(sessionId, 'session.authenticated', data);
    }
    emitSessionDisconnected(sessionId, data) {
        this.emitToRooms(sessionId, 'session.disconnected', data);
    }
    emitQRCode(sessionId, qrCode) {
        this.emitToRooms(sessionId, 'session.qr', { qrCode });
    }
    emitMessage(sessionId, message) {
        this.emitToRooms(sessionId, 'message.received', message);
    }
    emitMessageSent(sessionId, message) {
        this.emitToRooms(sessionId, 'message.sent', message);
    }
    emitMessageAck(sessionId, data) {
        this.emitToRooms(sessionId, 'message.ack', data);
    }
    emitMessageRevoked(sessionId, message) {
        this.emitToRooms(sessionId, 'message.revoked', message);
    }
    emitMessageReaction(sessionId, data) {
        this.emitToRooms(sessionId, 'message.reaction', data);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleMessage", null);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: resolveWsCorsOrigin(),
        },
        namespace: '/events',
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        audit_service_1.AuditService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map