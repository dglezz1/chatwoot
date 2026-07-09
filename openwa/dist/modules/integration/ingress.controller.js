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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngressController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const ingress_service_1 = require("./ingress.service");
const instance_throttler_guard_1 = require("./instance-throttler.guard");
let IngressController = class IngressController {
    ingress;
    constructor(ingress) {
        this.ingress = ingress;
    }
    async receive(pluginId, instanceId, query, req, res) {
        const wildcard = req.params.path;
        const segments = Array.isArray(wildcard)
            ? wildcard
            : typeof wildcard === 'string'
                ? wildcard.split('/').filter(Boolean)
                : [];
        const route = segments[0] ?? '';
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : String(v ?? '')]));
        const rawBody = req.rawBody?.toString('utf8') ?? '';
        const result = await this.ingress.handle({
            pluginId,
            instanceId,
            route,
            method: req.method,
            headers,
            query,
            rawBody,
        });
        res.status(result.status).send(result.body ?? '');
    }
};
exports.IngressController = IngressController;
__decorate([
    (0, common_1.UseGuards)(instance_throttler_guard_1.InstanceThrottlerGuard),
    (0, common_1.All)(':pluginId/:instanceId/*path'),
    (0, swagger_1.ApiOkResponse)({
        description: 'GET verification challenge echo, or a duplicate delivery already persisted (idempotent re-delivery). Not the primary success path — see 202.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 202,
        description: 'Webhook accepted and queued for async plugin processing (the primary success path).',
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Signature verification failed (missing, stale, or wrong secret).' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'GET verification challenge failed (verifyToken mismatch).' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Unknown pluginId/instanceId, or no route claimed by the plugin.' }),
    (0, swagger_1.ApiResponse)({ status: 413, description: 'Request body exceeds the route maxBodyBytes limit.' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Per-instance rate limit exceeded (INGRESS_INSTANCE_LIMIT).' }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Param)('instanceId')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], IngressController.prototype, "receive", null);
exports.IngressController = IngressController = __decorate([
    (0, swagger_1.ApiTags)('integration'),
    (0, auth_decorators_1.Public)(),
    (0, common_1.Controller)('ingress'),
    __metadata("design:paramtypes", [ingress_service_1.IngressService])
], IngressController);
//# sourceMappingURL=ingress.controller.js.map