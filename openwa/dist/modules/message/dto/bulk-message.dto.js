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
exports.BulkMessageResponseDto = exports.SendBulkMessageDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class BulkMediaDto {
    url;
    base64;
    mimetype;
    filename;
    ptt;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Media URL (http/https)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkMediaDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Base64-encoded media data' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkMediaDto.prototype, "base64", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Media MIME type' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkMediaDto.prototype, "mimetype", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filename (documents only)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkMediaDto.prototype, "filename", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Audio only: send as a WhatsApp voice note (PTT)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BulkMediaDto.prototype, "ptt", void 0);
class BulkMessageContentDto {
    text;
    image;
    video;
    audio;
    document;
    caption;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Text content for text messages', maxLength: 4096 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], BulkMessageContentDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Image URL or base64', type: BulkMediaDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkMediaDto),
    __metadata("design:type", BulkMediaDto)
], BulkMessageContentDto.prototype, "image", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Video URL or base64', type: BulkMediaDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkMediaDto),
    __metadata("design:type", BulkMediaDto)
], BulkMessageContentDto.prototype, "video", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Audio URL or base64', type: BulkMediaDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkMediaDto),
    __metadata("design:type", BulkMediaDto)
], BulkMessageContentDto.prototype, "audio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Document URL or base64', type: BulkMediaDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkMediaDto),
    __metadata("design:type", BulkMediaDto)
], BulkMessageContentDto.prototype, "document", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Caption for media messages', maxLength: 1024 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], BulkMessageContentDto.prototype, "caption", void 0);
class BulkMessageItemDto {
    chatId;
    type;
    content;
    variables;
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Recipient chat ID', example: '628123456789@c.us' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkMessageItemDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Message type', enum: ['text', 'image', 'video', 'audio', 'document'] }),
    (0, class_validator_1.IsIn)(['text', 'image', 'video', 'audio', 'document']),
    __metadata("design:type", String)
], BulkMessageItemDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Message content based on type' }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkMessageContentDto),
    __metadata("design:type", BulkMessageContentDto)
], BulkMessageItemDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Variables for template substitution' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], BulkMessageItemDto.prototype, "variables", void 0);
class BulkMessageOptionsDto {
    delayBetweenMessages;
    randomizeDelay;
    stopOnError;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Delay between messages in ms (min: 1000, default: 3000)', default: 3000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1000),
    (0, class_validator_1.Max)(60000),
    __metadata("design:type", Number)
], BulkMessageOptionsDto.prototype, "delayBetweenMessages", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Add random 0-2s to delay', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BulkMessageOptionsDto.prototype, "randomizeDelay", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Stop batch on first error', default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BulkMessageOptionsDto.prototype, "stopOnError", void 0);
class SendBulkMessageDto {
    batchId;
    messages;
    options;
}
exports.SendBulkMessageDto = SendBulkMessageDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Custom batch ID (auto-generated if not provided)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendBulkMessageDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Array of messages (max 100 per request)', type: [BulkMessageItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkMessageItemDto),
    __metadata("design:type", Array)
], SendBulkMessageDto.prototype, "messages", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Batch processing options' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkMessageOptionsDto),
    __metadata("design:type", BulkMessageOptionsDto)
], SendBulkMessageDto.prototype, "options", void 0);
class BulkMessageResponseDto {
    batchId;
    status;
    totalMessages;
    estimatedCompletionTime;
    statusUrl;
}
exports.BulkMessageResponseDto = BulkMessageResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BulkMessageResponseDto.prototype, "batchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BulkMessageResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BulkMessageResponseDto.prototype, "totalMessages", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], BulkMessageResponseDto.prototype, "estimatedCompletionTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BulkMessageResponseDto.prototype, "statusUrl", void 0);
//# sourceMappingURL=bulk-message.dto.js.map