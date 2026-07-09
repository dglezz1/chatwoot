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
exports.ApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("../auth.service");
const auth_decorators_1 = require("../decorators/auth.decorators");
const ip_1 = require("../../../common/utils/ip");
const audit_service_1 = require("../../audit/audit.service");
const audit_log_entity_1 = require("../../audit/entities/audit-log.entity");
let ApiKeyGuard = class ApiKeyGuard {
    authService;
    reflector;
    configService;
    auditService;
    constructor(authService, reflector, configService, auditService) {
        this.authService = authService;
        this.reflector = reflector;
        this.configService = configService;
        this.auditService = auditService;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(auth_decorators_1.PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        try {
            return await this.authorize(request, context);
        }
        catch (err) {
            if (err instanceof common_1.UnauthorizedException || err instanceof common_1.ForbiddenException) {
                void this.auditService.logWarn(audit_log_entity_1.AuditAction.API_KEY_AUTH_FAILED, {
                    ipAddress: this.getClientIp(request),
                    method: request.method,
                    path: request.path,
                    errorMessage: err.message,
                });
            }
            throw err;
        }
    }
    async authorize(request, context) {
        const apiKeyHeader = this.extractApiKey(request);
        if (!apiKeyHeader) {
            throw new common_1.UnauthorizedException('API key is required');
        }
        const requiredRole = this.reflector.getAllAndOverride(auth_decorators_1.REQUIRED_ROLE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const sessionScoped = this.reflector.getAllAndOverride(auth_decorators_1.SESSION_SCOPED_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const sessionId = (request.params['sessionId'] || (sessionScoped ? request.params['id'] : undefined));
        const clientIp = this.getClientIp(request);
        const apiKey = await this.authService.validateApiKey(apiKeyHeader, clientIp, sessionId);
        if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
            throw new common_1.ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
        }
        request.apiKey = apiKey;
        request.clientIp = clientIp;
        return true;
    }
    extractApiKey(request) {
        const xApiKey = request.headers['x-api-key'];
        if (xApiKey)
            return xApiKey;
        const authHeader = request.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return undefined;
    }
    getClientIp(request) {
        const trustedProxies = this.configService.get('security.trustedProxies') ?? [];
        return (0, ip_1.resolveClientIp)(request, trustedProxies);
    }
};
exports.ApiKeyGuard = ApiKeyGuard;
exports.ApiKeyGuard = ApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        core_1.Reflector,
        config_1.ConfigService,
        audit_service_1.AuditService])
], ApiKeyGuard);
//# sourceMappingURL=api-key.guard.js.map