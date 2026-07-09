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
exports.MarkChatReadDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class MarkChatReadDto {
    chatId;
}
exports.MarkChatReadDto = MarkChatReadDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Chat ID in the active engine's native format (e.g. 1234567890@c.us on whatsapp-web.js)",
        example: '1234567890@c.us',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^[^\s@]+@[^\s@]+$/, {
        message: 'chatId must be a valid chat JID in the form localpart@host',
    }),
    __metadata("design:type", String)
], MarkChatReadDto.prototype, "chatId", void 0);
//# sourceMappingURL=mark-chat-read.dto.js.map