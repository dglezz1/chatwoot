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
exports.WebhookResponseDto = exports.UpdateWebhookDto = exports.CreateWebhookDto = exports.WEBHOOK_EVENTS = exports.WEBHOOK_RESERVED_EVENTS = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const filter_validation_1 = require("../filters/filter-validation");
const is_header_map_validator_1 = require("./is-header-map.validator");
const FILTERS_API_DESCRIPTION = 'Optional smart pre-filter. When set, every condition must match (AND) for the webhook to fire. Omit or null to fire on every subscribed event.';
const FILTERS_API_EXAMPLE = {
    conditions: [
        { field: 'sender', operator: 'is', value: ['1234567890@c.us'] },
        { field: 'body', operator: 'contains', value: 'invoice' },
    ],
};
exports.WEBHOOK_RESERVED_EVENTS = ['group.join', 'group.leave', 'group.update'];
exports.WEBHOOK_EVENTS = [
    'message.received',
    'message.sent',
    'message.ack',
    'message.failed',
    'message.revoked',
    'message.reaction',
    'session.status',
    'session.qr',
    'session.authenticated',
    'session.disconnected',
    ...exports.WEBHOOK_RESERVED_EVENTS,
];
class CreateWebhookDto {
    url;
    events;
    secret;
    headers;
    filters;
    retryCount;
}
exports.CreateWebhookDto = CreateWebhookDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Webhook URL to receive events',
        example: 'https://your-server.com/webhook',
    }),
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], CreateWebhookDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "Event types to subscribe to. '*' subscribes to all events.",
        example: ['message.received', 'session.status'],
        enum: [...exports.WEBHOOK_EVENTS, '*'],
        type: String,
        isArray: true,
        minItems: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsIn)([...exports.WEBHOOK_EVENTS, '*'], { each: true }),
    __metadata("design:type", Array)
], CreateWebhookDto.prototype, "events", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Secret key for HMAC signature verification',
        example: 'your-secret-key',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateWebhookDto.prototype, "secret", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Custom headers to include in webhook requests',
        example: { 'X-Custom-Header': 'value' },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, is_header_map_validator_1.IsHeaderMap)(),
    __metadata("design:type", Object)
], CreateWebhookDto.prototype, "headers", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: FILTERS_API_DESCRIPTION, example: FILTERS_API_EXAMPLE }),
    (0, class_validator_1.IsOptional)(),
    (0, filter_validation_1.IsValidWebhookFilters)(),
    __metadata("design:type", Object)
], CreateWebhookDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Number of retry attempts on failure',
        example: 3,
        minimum: 0,
        maximum: 5,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], CreateWebhookDto.prototype, "retryCount", void 0);
class UpdateWebhookDto {
    url;
    events;
    secret;
    headers;
    filters;
    active;
    retryCount;
}
exports.UpdateWebhookDto = UpdateWebhookDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Webhook URL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], UpdateWebhookDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "Event types to subscribe to. '*' subscribes to all events.",
        enum: [...exports.WEBHOOK_EVENTS, '*'],
        type: String,
        isArray: true,
        minItems: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsIn)([...exports.WEBHOOK_EVENTS, '*'], { each: true }),
    __metadata("design:type", Array)
], UpdateWebhookDto.prototype, "events", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Secret key for HMAC signature' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateWebhookDto.prototype, "secret", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Custom headers' }),
    (0, class_validator_1.IsOptional)(),
    (0, is_header_map_validator_1.IsHeaderMap)(),
    __metadata("design:type", Object)
], UpdateWebhookDto.prototype, "headers", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: FILTERS_API_DESCRIPTION, example: FILTERS_API_EXAMPLE }),
    (0, class_validator_1.IsOptional)(),
    (0, filter_validation_1.IsValidWebhookFilters)(),
    __metadata("design:type", Object)
], UpdateWebhookDto.prototype, "filters", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Enable/disable webhook' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateWebhookDto.prototype, "active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Retry count' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], UpdateWebhookDto.prototype, "retryCount", void 0);
class WebhookResponseDto {
    id;
    sessionId;
    url;
    events;
    filters;
    active;
    retryCount;
    lastTriggeredAt;
    createdAt;
    updatedAt;
    static fromEntity(entity) {
        return (0, class_transformer_1.plainToInstance)(WebhookResponseDto, entity, { excludeExtraneousValues: true });
    }
    static fromEntities(entities) {
        return entities.map(entity => WebhookResponseDto.fromEntity(entity));
    }
}
exports.WebhookResponseDto = WebhookResponseDto;
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WebhookResponseDto.prototype, "id", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WebhookResponseDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], WebhookResponseDto.prototype, "url", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Array)
], WebhookResponseDto.prototype, "events", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiPropertyOptional)({ description: FILTERS_API_DESCRIPTION, example: FILTERS_API_EXAMPLE }),
    __metadata("design:type", Object)
], WebhookResponseDto.prototype, "filters", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], WebhookResponseDto.prototype, "active", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], WebhookResponseDto.prototype, "retryCount", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Object)
], WebhookResponseDto.prototype, "lastTriggeredAt", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], WebhookResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, class_transformer_1.Expose)(),
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], WebhookResponseDto.prototype, "updatedAt", void 0);
//# sourceMappingURL=webhook.dto.js.map