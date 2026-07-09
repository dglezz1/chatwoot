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
exports.UpdateApiKeyDto = exports.ApiKeyCreatedResponseDto = exports.ApiKeyResponseDto = exports.CreateApiKeyDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const api_key_entity_1 = require("../entities/api-key.entity");
const is_ip_or_cidr_validator_1 = require("./is-ip-or-cidr.validator");
class CreateApiKeyDto {
    name;
    role;
    allowedIps;
    allowedSessions;
    expiresAt;
}
exports.CreateApiKeyDto = CreateApiKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Friendly name for the API key',
        example: 'Production Bot',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateApiKeyDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Role/permission level',
        enum: api_key_entity_1.ApiKeyRole,
        default: api_key_entity_1.ApiKeyRole.OPERATOR,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(api_key_entity_1.ApiKeyRole),
    __metadata("design:type", String)
], CreateApiKeyDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Allowed IP addresses (whitelist)',
        example: ['192.168.1.1', '10.0.0.0/8'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Validate)(is_ip_or_cidr_validator_1.IsIpOrCidrConstraint, { each: true }),
    __metadata("design:type", Array)
], CreateApiKeyDto.prototype, "allowedIps", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Allowed session IDs this key can access',
        example: ['session-uuid-1', 'session-uuid-2'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateApiKeyDto.prototype, "allowedSessions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Expiration date (ISO 8601)',
        example: '2027-12-31T23:59:59Z',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateApiKeyDto.prototype, "expiresAt", void 0);
class ApiKeyResponseDto {
    id;
    name;
    keyPrefix;
    role;
    allowedIps;
    allowedSessions;
    isActive;
    expiresAt;
    lastUsedAt;
    usageCount;
    createdAt;
}
exports.ApiKeyResponseDto = ApiKeyResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ApiKeyResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ApiKeyResponseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'First 8 characters of the key (for identification)',
    }),
    __metadata("design:type", String)
], ApiKeyResponseDto.prototype, "keyPrefix", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: api_key_entity_1.ApiKeyRole }),
    __metadata("design:type", String)
], ApiKeyResponseDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Array)
], ApiKeyResponseDto.prototype, "allowedIps", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Array)
], ApiKeyResponseDto.prototype, "allowedSessions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ApiKeyResponseDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Date)
], ApiKeyResponseDto.prototype, "expiresAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Date)
], ApiKeyResponseDto.prototype, "lastUsedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ApiKeyResponseDto.prototype, "usageCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], ApiKeyResponseDto.prototype, "createdAt", void 0);
class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {
    apiKey;
}
exports.ApiKeyCreatedResponseDto = ApiKeyCreatedResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Full API key (only shown once at creation)',
        example: 'owa_k1_abc123...',
    }),
    __metadata("design:type", String)
], ApiKeyCreatedResponseDto.prototype, "apiKey", void 0);
class UpdateApiKeyDto {
    name;
    role;
    allowedIps;
    allowedSessions;
    expiresAt;
}
exports.UpdateApiKeyDto = UpdateApiKeyDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], UpdateApiKeyDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: api_key_entity_1.ApiKeyRole }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(api_key_entity_1.ApiKeyRole),
    __metadata("design:type", String)
], UpdateApiKeyDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Validate)(is_ip_or_cidr_validator_1.IsIpOrCidrConstraint, { each: true }),
    __metadata("design:type", Array)
], UpdateApiKeyDto.prototype, "allowedIps", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateApiKeyDto.prototype, "allowedSessions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateApiKeyDto.prototype, "expiresAt", void 0);
//# sourceMappingURL=api-key.dto.js.map