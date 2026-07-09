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
exports.ChannelController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const channel_service_1 = require("./channel.service");
const subscribe_channel_dto_1 = require("./dto/subscribe-channel.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let ChannelController = class ChannelController {
    channelService;
    constructor(channelService) {
        this.channelService = channelService;
    }
    async findAll(sessionId) {
        return this.channelService.getSubscribedChannels(sessionId);
    }
    async findOne(sessionId, channelId) {
        return this.channelService.getChannelById(sessionId, channelId);
    }
    async getMessages(sessionId, channelId, limit) {
        const parsed = limit !== undefined ? parseInt(limit, 10) : NaN;
        return this.channelService.getChannelMessages(sessionId, channelId, Number.isNaN(parsed) ? undefined : parsed);
    }
    async subscribe(sessionId, body) {
        return this.channelService.subscribeToChannel(sessionId, body.inviteCode);
    }
    async unsubscribe(sessionId, channelId) {
        await this.channelService.unsubscribeFromChannel(sessionId, channelId);
        return { success: true };
    }
};
exports.ChannelController = ChannelController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all subscribed channels/newsletters' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of subscribed channels',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':channelId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific channel by ID' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Channel details',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Channel not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':channelId/messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Get messages from a channel' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max messages to return (default 50)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of channel messages',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Subscribe to a channel using invite code' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                inviteCode: {
                    type: 'string',
                    description: 'Channel invite code (from channel link)',
                    example: 'ABC123xyz',
                },
            },
            required: ['inviteCode'],
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Successfully subscribed to channel',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscribe_channel_dto_1.SubscribeChannelDto]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Delete)(':channelId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Unsubscribe from a channel' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'channelId', description: 'Channel ID to unsubscribe from' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Successfully unsubscribed from channel',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChannelController.prototype, "unsubscribe", null);
exports.ChannelController = ChannelController = __decorate([
    (0, swagger_1.ApiTags)('channels'),
    (0, common_1.Controller)('sessions/:sessionId/channels'),
    __metadata("design:paramtypes", [channel_service_1.ChannelService])
], ChannelController);
//# sourceMappingURL=channel.controller.js.map