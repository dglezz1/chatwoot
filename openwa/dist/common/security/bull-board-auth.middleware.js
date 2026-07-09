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
exports.BullBoardAuthMiddleware = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("../../modules/auth/auth.service");
const api_key_entity_1 = require("../../modules/auth/entities/api-key.entity");
const ip_1 = require("../utils/ip");
let BullBoardAuthMiddleware = class BullBoardAuthMiddleware {
    authService;
    configService;
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    async use(req, _res, next) {
        try {
            const rawKey = this.extractKey(req);
            if (!rawKey) {
                throw new common_1.UnauthorizedException('API key is required to access the queue dashboard');
            }
            const apiKey = await this.authService.validateApiKey(rawKey, this.getClientIp(req));
            if (!this.authService.hasPermission(apiKey, api_key_entity_1.ApiKeyRole.ADMIN)) {
                throw new common_1.ForbiddenException('Admin role required to access the queue dashboard');
            }
            next();
        }
        catch (err) {
            next(err);
        }
    }
    extractKey(req) {
        const header = req.headers['x-api-key'];
        if (typeof header === 'string' && header)
            return header;
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer '))
            return authHeader.slice(7);
        return undefined;
    }
    getClientIp(req) {
        const trustedProxies = this.configService.get('security.trustedProxies') ?? [];
        return (0, ip_1.resolveClientIp)(req, trustedProxies);
    }
};
exports.BullBoardAuthMiddleware = BullBoardAuthMiddleware;
exports.BullBoardAuthMiddleware = BullBoardAuthMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], BullBoardAuthMiddleware);
//# sourceMappingURL=bull-board-auth.middleware.js.map