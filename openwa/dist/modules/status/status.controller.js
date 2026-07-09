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
exports.StatusController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const status_service_1 = require("./status.service");
const send_text_status_dto_1 = require("./dto/send-text-status.dto");
const send_media_status_dto_1 = require("./dto/send-media-status.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let StatusController = class StatusController {
    statusService;
    constructor(statusService) {
        this.statusService = statusService;
    }
    async getStatuses(sessionId) {
        return { statuses: await this.statusService.getStatuses(sessionId) };
    }
    async getContactStatus(sessionId, contactId) {
        return { statuses: await this.statusService.getContactStatus(sessionId, contactId) };
    }
    async sendTextStatus(sessionId, dto) {
        return this.statusService.postTextStatus(sessionId, dto.text, {
            recipients: dto.recipients,
            backgroundColor: dto.backgroundColor,
            font: dto.font,
        });
    }
    async sendImageStatus(sessionId, dto) {
        return this.statusService.postImageStatus(sessionId, dto.image, {
            recipients: dto.recipients,
            caption: dto.caption,
        });
    }
    async sendVideoStatus(sessionId, dto) {
        return this.statusService.postVideoStatus(sessionId, dto.video, {
            recipients: dto.recipients,
            caption: dto.caption,
        });
    }
    async deleteStatus(sessionId, statusId) {
        await this.statusService.deleteStatus(sessionId, statusId);
        return { message: 'Status deleted successfully' };
    }
};
exports.StatusController = StatusController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all contact status updates' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Status updates visible to the session, grouped by contact.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "getStatuses", null);
__decorate([
    (0, common_1.Get)(':contactId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get status updates from a specific contact' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Status updates from the requested contact.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "getContactStatus", null);
__decorate([
    (0, common_1.Post)('send-text'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Post a text status (Baileys only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Text status posted to the specified recipients.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_text_status_dto_1.SendTextStatusDto]),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "sendTextStatus", null);
__decorate([
    (0, common_1.Post)('send-image'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Post an image status (Baileys only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Image status posted to the specified recipients.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_media_status_dto_1.SendImageStatusDto]),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "sendImageStatus", null);
__decorate([
    (0, common_1.Post)('send-video'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Post a video status (Baileys only)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Video status posted to the specified recipients.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_media_status_dto_1.SendVideoStatusDto]),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "sendVideoStatus", null);
__decorate([
    (0, common_1.Delete)(':statusId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Delete own status' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Status deleted.' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('statusId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "deleteStatus", null);
exports.StatusController = StatusController = __decorate([
    (0, swagger_1.ApiTags)('status'),
    (0, common_1.Controller)('sessions/:sessionId/status'),
    __metadata("design:paramtypes", [status_service_1.StatusService])
], StatusController);
//# sourceMappingURL=status.controller.js.map