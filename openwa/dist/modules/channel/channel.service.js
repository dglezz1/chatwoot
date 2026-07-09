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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../session/session.service");
let ChannelService = class ChannelService {
    sessionService;
    constructor(sessionService) {
        this.sessionService = sessionService;
    }
    getEngine(sessionId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine;
    }
    getSubscribedChannels(sessionId) {
        return this.getEngine(sessionId).getSubscribedChannels();
    }
    async getChannelById(sessionId, channelId) {
        const channel = await this.getEngine(sessionId).getChannelById(channelId);
        if (!channel) {
            throw new common_1.NotFoundException(`Channel ${channelId} not found`);
        }
        return channel;
    }
    getChannelMessages(sessionId, channelId, limit) {
        return this.getEngine(sessionId).getChannelMessages(channelId, limit);
    }
    subscribeToChannel(sessionId, inviteCode) {
        return this.getEngine(sessionId).subscribeToChannel(inviteCode);
    }
    unsubscribeFromChannel(sessionId, channelId) {
        return this.getEngine(sessionId).unsubscribeFromChannel(channelId);
    }
};
exports.ChannelService = ChannelService;
exports.ChannelService = ChannelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], ChannelService);
//# sourceMappingURL=channel.service.js.map