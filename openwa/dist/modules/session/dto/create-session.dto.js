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
exports.CreateSessionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateSessionDto {
    name;
    config;
    proxyUrl;
    proxyType;
}
exports.CreateSessionDto = CreateSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unique name for the session (alphanumeric and hyphens only)',
        example: 'my-bot',
        minLength: 3,
        maxLength: 50,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(50),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9-]+$/, {
        message: 'Session name can only contain letters, numbers, and hyphens',
    }),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Session configuration options',
        example: { autoReconnect: true },
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateSessionDto.prototype, "config", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Proxy URL for this session (e.g., http://user:pass@proxy.example.com:8080)',
        example: 'http://proxy.example.com:8080',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    (0, class_validator_1.IsUrl)({
        protocols: ['http', 'https', 'socks4', 'socks5'],
        require_protocol: true,
        require_tld: false,
        allow_underscores: true,
    }, { message: 'proxyUrl must be a valid http(s)/socks4/socks5 URL' }),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "proxyUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Proxy type',
        enum: ['http', 'https', 'socks4', 'socks5'],
        example: 'http',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['http', 'https', 'socks4', 'socks5']),
    __metadata("design:type", String)
], CreateSessionDto.prototype, "proxyType", void 0);
//# sourceMappingURL=create-session.dto.js.map