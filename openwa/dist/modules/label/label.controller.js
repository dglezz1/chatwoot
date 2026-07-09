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
exports.LabelController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const label_service_1 = require("./label.service");
const add_label_dto_1 = require("./dto/add-label.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let LabelController = class LabelController {
    labelService;
    constructor(labelService) {
        this.labelService = labelService;
    }
    async findAll(sessionId) {
        return this.labelService.getLabels(sessionId);
    }
    async findOne(sessionId, labelId) {
        return this.labelService.getLabelById(sessionId, labelId);
    }
    async getChatLabels(sessionId, chatId) {
        return this.labelService.getChatLabels(sessionId, chatId);
    }
    async addLabelToChat(sessionId, chatId, body) {
        await this.labelService.addLabelToChat(sessionId, chatId, body.labelId);
        return { success: true };
    }
    async removeLabelFromChat(sessionId, chatId, labelId) {
        await this.labelService.removeLabelFromChat(sessionId, chatId, labelId);
        return { success: true };
    }
};
exports.LabelController = LabelController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all labels (WhatsApp Business only)' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of labels',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready or not a business account' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':labelId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific label by ID' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Label details',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Label not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('labelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('chat/:chatId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get labels for a specific chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of labels for the chat',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "getChatLabels", null);
__decorate([
    (0, common_1.Post)('chat/:chatId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Add a label to a chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                labelId: { type: 'string', description: 'Label ID to add' },
            },
            required: ['labelId'],
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Label added to chat',
    }),
    (0, swagger_1.ApiResponse)({
        status: 422,
        description: 'Labels require a WhatsApp Business account, or the chat type has no labels',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, add_label_dto_1.AddLabelDto]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "addLabelToChat", null);
__decorate([
    (0, common_1.Delete)('chat/:chatId/:labelId'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a label from a chat' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'chatId', description: 'Chat ID' }),
    (0, swagger_1.ApiParam)({ name: 'labelId', description: 'Label ID to remove' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Label removed from chat',
    }),
    (0, swagger_1.ApiResponse)({
        status: 422,
        description: 'Labels require a WhatsApp Business account, or the chat type has no labels',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('chatId')),
    __param(2, (0, common_1.Param)('labelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "removeLabelFromChat", null);
exports.LabelController = LabelController = __decorate([
    (0, swagger_1.ApiTags)('labels'),
    (0, common_1.Controller)('sessions/:sessionId/labels'),
    __metadata("design:paramtypes", [label_service_1.LabelService])
], LabelController);
//# sourceMappingURL=label.controller.js.map