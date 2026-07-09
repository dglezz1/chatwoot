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
exports.MessageResponseDto = exports.SendAudioMessageDto = exports.SendMediaMessageDto = exports.SendTextMessageDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const MENTIONS_DESCRIPTION = 'WIDs to @mention (e.g. ["62811@c.us"]). The text/caption must also contain the @<number> token.';
class SendTextMessageDto {
    chatId;
    text;
    mentions;
}
exports.SendTextMessageDto = SendTextMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'WhatsApp chat ID (phone@c.us for individual, groupId@g.us for groups)',
        example: '628123456789@c.us',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendTextMessageDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Text message content',
        example: 'Hello from OpenWA!',
        maxLength: 4096,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], SendTextMessageDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: MENTIONS_DESCRIPTION, example: ['628123456789@c.us'], type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1024),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(64, { each: true }),
    __metadata("design:type", Array)
], SendTextMessageDto.prototype, "mentions", void 0);
class SendMediaMessageDto {
    chatId;
    url;
    base64;
    mimetype;
    filename;
    caption;
    mentions;
}
exports.SendMediaMessageDto = SendMediaMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'WhatsApp chat ID',
        example: '628123456789@c.us',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendMediaMessageDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Media URL (http/https)',
        example: 'https://example.com/image.jpg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.ValidateIf)((o) => !o.base64),
    __metadata("design:type", String)
], SendMediaMessageDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Base64 encoded media data',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.ValidateIf)((o) => !o.url),
    __metadata("design:type", String)
], SendMediaMessageDto.prototype, "base64", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Media MIME type (required when using base64)',
        example: 'image/jpeg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendMediaMessageDto.prototype, "mimetype", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filename for the media',
        example: 'image.jpg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SendMediaMessageDto.prototype, "filename", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Caption for the media',
        example: 'Check out this image!',
        maxLength: 1024,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], SendMediaMessageDto.prototype, "caption", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: MENTIONS_DESCRIPTION, example: ['628123456789@c.us'], type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1024),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(64, { each: true }),
    __metadata("design:type", Array)
], SendMediaMessageDto.prototype, "mentions", void 0);
class SendAudioMessageDto extends SendMediaMessageDto {
    ptt;
}
exports.SendAudioMessageDto = SendAudioMessageDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Send as a WhatsApp voice note (PTT — mic bubble + waveform). Provide audio/ogg; codecs=opus ' +
            'bytes for reliable playback; when the mimetype is omitted it defaults to that for voice notes. ' +
            'Expects a JSON boolean. Default false = plain audio file. Only valid on send-audio.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SendAudioMessageDto.prototype, "ptt", void 0);
class MessageResponseDto {
    messageId;
    timestamp;
}
exports.MessageResponseDto = MessageResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'true_628123456789@c.us_3EB0123456789' }),
    __metadata("design:type", String)
], MessageResponseDto.prototype, "messageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1706868000 }),
    __metadata("design:type", Number)
], MessageResponseDto.prototype, "timestamp", void 0);
//# sourceMappingURL=send-message.dto.js.map