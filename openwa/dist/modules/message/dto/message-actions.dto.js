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
exports.DeleteMessageDto = exports.ReactMessageDto = exports.ForwardMessageDto = exports.ReplyMessageDto = exports.SendPollDto = exports.SendContactDto = exports.SendLocationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SendLocationDto {
    chatId;
    latitude;
    longitude;
    description;
    address;
}
exports.SendLocationDto = SendLocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chat ID (e.g. 628123456789@c.us)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendLocationDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: -6.2088 }),
    (0, class_validator_1.IsLatitude)(),
    __metadata("design:type", Number)
], SendLocationDto.prototype, "latitude", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 106.8456 }),
    (0, class_validator_1.IsLongitude)(),
    __metadata("design:type", Number)
], SendLocationDto.prototype, "longitude", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1024 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], SendLocationDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1024 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], SendLocationDto.prototype, "address", void 0);
class SendContactDto {
    chatId;
    contactName;
    contactNumber;
}
exports.SendContactDto = SendContactDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendContactDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 255 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SendContactDto.prototype, "contactName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 30 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], SendContactDto.prototype, "contactNumber", void 0);
class SendPollDto {
    chatId;
    name;
    options;
    allowMultipleAnswers;
}
exports.SendPollDto = SendPollDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Chat ID (e.g. 628123456789@c.us or 1203630000@g.us)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendPollDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Poll question / title', maxLength: 255, example: 'Where should we meet?' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], SendPollDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Options to vote on (WhatsApp allows between 2 and 12)',
        type: [String],
        example: ['Park', 'Beach', 'Downtown'],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ArrayMaxSize)(12),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsNotEmpty)({ each: true }),
    (0, class_validator_1.MaxLength)(100, { each: true }),
    __metadata("design:type", Array)
], SendPollDto.prototype, "options", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Allow voters to pick several options (default single choice)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SendPollDto.prototype, "allowMultipleAnswers", void 0);
class ReplyMessageDto {
    chatId;
    quotedMessageId;
    text;
}
exports.ReplyMessageDto = ReplyMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReplyMessageDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReplyMessageDto.prototype, "quotedMessageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 4096 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], ReplyMessageDto.prototype, "text", void 0);
class ForwardMessageDto {
    fromChatId;
    toChatId;
    messageId;
}
exports.ForwardMessageDto = ForwardMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ForwardMessageDto.prototype, "fromChatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ForwardMessageDto.prototype, "toChatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ForwardMessageDto.prototype, "messageId", void 0);
class ReactMessageDto {
    chatId;
    messageId;
    emoji;
}
exports.ReactMessageDto = ReactMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReactMessageDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReactMessageDto.prototype, "messageId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Emoji to react with. Send an empty string to remove the reaction.', maxLength: 32 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], ReactMessageDto.prototype, "emoji", void 0);
class DeleteMessageDto {
    chatId;
    messageId;
    forEveryone;
}
exports.DeleteMessageDto = DeleteMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeleteMessageDto.prototype, "chatId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DeleteMessageDto.prototype, "messageId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Delete for everyone (default true)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeleteMessageDto.prototype, "forEveryone", void 0);
//# sourceMappingURL=message-actions.dto.js.map