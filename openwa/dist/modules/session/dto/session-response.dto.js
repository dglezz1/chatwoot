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
exports.QRCodeResponseDto = exports.SessionResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const session_entity_1 = require("../entities/session.entity");
class SessionResponseDto {
    id;
    name;
    status;
    phone;
    pushName;
    connectedAt;
    lastActive;
    createdAt;
    updatedAt;
    lastError;
    static fromEntity(session) {
        return {
            id: session.id,
            name: session.name,
            status: session.status,
            phone: session.phone,
            pushName: session.pushName,
            connectedAt: session.connectedAt,
            lastActive: session.lastActiveAt,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastError: session.lastError ?? null,
        };
    }
}
exports.SessionResponseDto = SessionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'sess_123e4567-e89b-12d3-a456-426614174000' }),
    __metadata("design:type", String)
], SessionResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'my-bot' }),
    __metadata("design:type", String)
], SessionResponseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: session_entity_1.SessionStatus, example: session_entity_1.SessionStatus.READY }),
    __metadata("design:type", String)
], SessionResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, example: '628123456789', nullable: true }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, example: 'John Doe', nullable: true }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "pushName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', example: '2025-02-02T10:00:00Z', nullable: true }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "connectedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: String, format: 'date-time', example: '2025-02-02T10:30:00Z', nullable: true }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "lastActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-02-02T09:00:00Z' }),
    __metadata("design:type", Date)
], SessionResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-02-02T10:00:00Z' }),
    __metadata("design:type", Date)
], SessionResponseDto.prototype, "updatedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: String,
        description: 'Human-readable reason for the most recent terminal engine failure (only set when status is FAILED).',
        example: 'Failed to launch the browser process: spawn /usr/bin/chromium ENOENT',
        nullable: true,
    }),
    __metadata("design:type", Object)
], SessionResponseDto.prototype, "lastError", void 0);
class QRCodeResponseDto {
    qrCode;
    status;
}
exports.QRCodeResponseDto = QRCodeResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'QR code as data URL',
        example: 'data:image/png;base64,...',
    }),
    __metadata("design:type", String)
], QRCodeResponseDto.prototype, "qrCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: session_entity_1.SessionStatus, example: session_entity_1.SessionStatus.QR_READY }),
    __metadata("design:type", String)
], QRCodeResponseDto.prototype, "status", void 0);
//# sourceMappingURL=session-response.dto.js.map