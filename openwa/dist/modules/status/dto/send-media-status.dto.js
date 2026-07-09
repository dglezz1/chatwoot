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
exports.SendVideoStatusDto = exports.SendImageStatusDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class StatusMediaInput {
    url;
    base64;
    mimetype;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Public http(s) URL of the media (server-fetched, SSRF-guarded).',
        example: 'https://example.com/banner.jpg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StatusMediaInput.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Base64-encoded media. Requires mimetype.',
        example: 'data:image/jpeg;base64,...',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StatusMediaInput.prototype, "base64", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'MIME type. Required when sending base64.', example: 'image/jpeg' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StatusMediaInput.prototype, "mimetype", void 0);
class SendImageStatusDto {
    image;
    caption;
    recipients;
}
exports.SendImageStatusDto = SendImageStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Image source (URL or base64).', type: StatusMediaInput }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => StatusMediaInput),
    __metadata("design:type", StatusMediaInput)
], SendImageStatusDto.prototype, "image", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional caption.', example: 'New drop!', maxLength: 1024 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], SendImageStatusDto.prototype, "caption", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Recipient JIDs (1–256), @c.us or @lid.',
        type: String,
        isArray: true,
        example: ['628123456789@c.us'],
        minItems: 1,
        maxItems: 256,
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(256),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(/^\d+@(c\.us|lid)$/, { each: true, message: 'Invalid recipient JID' }),
    __metadata("design:type", Array)
], SendImageStatusDto.prototype, "recipients", void 0);
class SendVideoStatusDto {
    video;
    caption;
    recipients;
}
exports.SendVideoStatusDto = SendVideoStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Video source (URL or base64).', type: StatusMediaInput }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => StatusMediaInput),
    __metadata("design:type", StatusMediaInput)
], SendVideoStatusDto.prototype, "video", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional caption.', example: 'Demo', maxLength: 1024 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], SendVideoStatusDto.prototype, "caption", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Recipient JIDs (1–256), @c.us or @lid.',
        type: String,
        isArray: true,
        example: ['628123456789@c.us'],
        minItems: 1,
        maxItems: 256,
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(256),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(/^\d+@(c\.us|lid)$/, { each: true, message: 'Invalid recipient JID' }),
    __metadata("design:type", Array)
], SendVideoStatusDto.prototype, "recipients", void 0);
//# sourceMappingURL=send-media-status.dto.js.map