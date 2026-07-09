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
exports.InstallFromUrlDto = exports.PluginSessionsDto = exports.PluginConfigDto = exports.PluginDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const plugins_1 = require("../../../core/plugins");
class PluginDto {
    id;
    name;
    version;
    type;
    description;
    author;
    status;
    config;
    builtIn;
    provides;
    ingressCapable;
    sessionScoped;
    activeSessions;
    configSchema;
    configUi;
    i18n;
    sessionConfig;
    loadedAt;
    enabledAt;
    error;
}
exports.PluginDto = PluginDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Plugin ID' }),
    __metadata("design:type", String)
], PluginDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Plugin name' }),
    __metadata("design:type", String)
], PluginDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Plugin version' }),
    __metadata("design:type", String)
], PluginDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: plugins_1.PluginType, description: 'Plugin type' }),
    __metadata("design:type", String)
], PluginDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Plugin description' }),
    __metadata("design:type", String)
], PluginDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Plugin author' }),
    __metadata("design:type", String)
], PluginDto.prototype, "author", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: plugins_1.PluginStatus, description: 'Plugin status' }),
    __metadata("design:type", String)
], PluginDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Plugin configuration' }),
    __metadata("design:type", Object)
], PluginDto.prototype, "config", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether this is a built-in plugin' }),
    __metadata("design:type", Boolean)
], PluginDto.prototype, "builtIn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Features provided by this plugin' }),
    __metadata("design:type", Array)
], PluginDto.prototype, "provides", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether this plugin can host provisioned ingress instances' }),
    __metadata("design:type", Boolean)
], PluginDto.prototype, "ingressCapable", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether the plugin is scoped to specific sessions (false = global)' }),
    __metadata("design:type", Boolean)
], PluginDto.prototype, "sessionScoped", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Sessions this plugin is activated for; ['*'] = all numbers" }),
    __metadata("design:type", Array)
], PluginDto.prototype, "activeSessions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Configuration schema' }),
    __metadata("design:type", Object)
], PluginDto.prototype, "configSchema", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Sandboxed-iframe config editor (entry HTML + optional height)' }),
    __metadata("design:type", Object)
], PluginDto.prototype, "configUi", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Localized dashboard text (name/description/config titles) per locale code' }),
    __metadata("design:type", Object)
], PluginDto.prototype, "i18n", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Per-session config overrides, keyed by sessionId (secrets redacted)' }),
    __metadata("design:type", Object)
], PluginDto.prototype, "sessionConfig", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'When the plugin was loaded' }),
    __metadata("design:type", String)
], PluginDto.prototype, "loadedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'When the plugin was enabled' }),
    __metadata("design:type", String)
], PluginDto.prototype, "enabledAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Error message if plugin is in error state' }),
    __metadata("design:type", String)
], PluginDto.prototype, "error", void 0);
class PluginConfigDto {
    config;
}
exports.PluginConfigDto = PluginConfigDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Plugin configuration object' }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PluginConfigDto.prototype, "config", void 0);
class PluginSessionsDto {
    sessions;
}
exports.PluginSessionsDto = PluginSessionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Sessions to activate the plugin for; ['*'] = all numbers, [] = none",
        example: ['*'],
        type: [String],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PluginSessionsDto.prototype, "sessions", void 0);
class InstallFromUrlDto {
    url;
}
exports.InstallFromUrlDto = InstallFromUrlDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'HTTP(S) URL of the plugin .zip to download and install' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsUrl)({ protocols: ['http', 'https'], require_protocol: true }),
    __metadata("design:type", String)
], InstallFromUrlDto.prototype, "url", void 0);
//# sourceMappingURL=plugin.dto.js.map