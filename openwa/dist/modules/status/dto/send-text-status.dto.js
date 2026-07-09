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
exports.SendTextStatusDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class SendTextStatusDto {
    text;
    backgroundColor;
    font;
    recipients;
}
exports.SendTextStatusDto = SendTextStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Status text body.', example: 'Out for delivery 📦', maxLength: 4096 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], SendTextStatusDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Background color (hex).', example: '#25D366' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^#[0-9A-Fa-f]{6}$/, { message: 'backgroundColor must be a hex color (e.g., #25D366)' }),
    __metadata("design:type", String)
], SendTextStatusDto.prototype, "backgroundColor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Font family index (0–5).', example: 0, minimum: 0, maximum: 5 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], SendTextStatusDto.prototype, "font", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Recipient JIDs (1–256). WhatsApp Status is not posted to a group — use @c.us or @lid individuals.',
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
], SendTextStatusDto.prototype, "recipients", void 0);
//# sourceMappingURL=send-text-status.dto.js.map