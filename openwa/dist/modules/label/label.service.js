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
exports.LabelService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../session/session.service");
let LabelService = class LabelService {
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
    getLabels(sessionId) {
        return this.getEngine(sessionId).getLabels();
    }
    async getLabelById(sessionId, labelId) {
        const label = await this.getEngine(sessionId).getLabelById(labelId);
        if (!label) {
            throw new common_1.NotFoundException(`Label ${labelId} not found`);
        }
        return label;
    }
    getChatLabels(sessionId, chatId) {
        return this.getEngine(sessionId).getChatLabels(chatId);
    }
    addLabelToChat(sessionId, chatId, labelId) {
        return this.getEngine(sessionId).addLabelToChat(chatId, labelId);
    }
    removeLabelFromChat(sessionId, chatId, labelId) {
        return this.getEngine(sessionId).removeLabelFromChat(chatId, labelId);
    }
};
exports.LabelService = LabelService;
exports.LabelService = LabelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], LabelService);
//# sourceMappingURL=label.service.js.map