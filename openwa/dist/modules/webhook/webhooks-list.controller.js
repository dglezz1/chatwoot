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
exports.WebhooksListController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const webhook_service_1 = require("./webhook.service");
const dto_1 = require("./dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let WebhooksListController = class WebhooksListController {
    webhookService;
    constructor(webhookService) {
        this.webhookService = webhookService;
    }
    async deliveryFailures(sessionId, limit, offset) {
        return this.webhookService.listDeliveryFailures({
            sessionId,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async findAll(apiKey, limit, offset) {
        return dto_1.WebhookResponseDto.fromEntities(await this.webhookService.findAll(apiKey?.allowedSessions, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        }));
    }
};
exports.WebhooksListController = WebhooksListController;
__decorate([
    (0, common_1.Get)('delivery-failures'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'List recently-failed webhook deliveries (all retries exhausted)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Permanently-failed webhook deliveries, most recent first' }),
    (0, swagger_1.ApiQuery)({ name: 'sessionId', required: false, description: 'Filter to a single session' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max records to return (1-1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of records to skip (for paging)' }),
    __param(0, (0, common_1.Query)('sessionId')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], WebhooksListController.prototype, "deliveryFailures", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'List webhooks visible to the calling key (scoped to its allowed sessions)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of webhooks',
        type: [dto_1.WebhookResponseDto],
    }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max webhooks to return (1-1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of webhooks to skip (for paging)' }),
    __param(0, (0, auth_decorators_1.CurrentApiKey)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_key_entity_1.ApiKey, String, String]),
    __metadata("design:returntype", Promise)
], WebhooksListController.prototype, "findAll", null);
exports.WebhooksListController = WebhooksListController = __decorate([
    (0, swagger_1.ApiTags)('webhooks'),
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [webhook_service_1.WebhookService])
], WebhooksListController);
//# sourceMappingURL=webhooks-list.controller.js.map