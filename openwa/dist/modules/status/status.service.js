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
exports.StatusService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../session/session.service");
let StatusService = class StatusService {
    sessionService;
    constructor(sessionService) {
        this.sessionService = sessionService;
    }
    async getStatuses(sessionId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.getContactStatuses();
    }
    async getContactStatus(sessionId, contactId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.getContactStatus(contactId);
    }
    async postTextStatus(sessionId, text, options) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.postTextStatus(text, options);
    }
    async postImageStatus(sessionId, media, options) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.postImageStatus({ mimetype: media.mimetype ?? 'image/jpeg', data: media.url || media.base64 || '' }, options);
    }
    async postVideoStatus(sessionId, media, options) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.postVideoStatus({ mimetype: media.mimetype ?? 'video/mp4', data: media.url || media.base64 || '' }, options);
    }
    async deleteStatus(sessionId, statusId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.deleteStatus(statusId);
    }
};
exports.StatusService = StatusService;
exports.StatusService = StatusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], StatusService);
//# sourceMappingURL=status.service.js.map