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
exports.IntegrationInstanceController = void 0;
const common_1 = require("@nestjs/common");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const audit_service_1 = require("../audit/audit.service");
const plugin_loader_service_1 = require("../../core/plugins/plugin-loader.service");
const plugin_instance_service_1 = require("./plugin-instance.service");
const scope_binding_service_1 = require("./scope-binding.service");
const ingress_url_1 = require("./ingress-url");
const instance_dto_1 = require("./dto/instance.dto");
const swagger_1 = require("@nestjs/swagger");
let IntegrationInstanceController = class IntegrationInstanceController {
    instances;
    loader;
    audit;
    scopeBinding;
    constructor(instances, loader, audit, scopeBinding) {
        this.instances = instances;
        this.loader = loader;
        this.audit = audit;
        this.scopeBinding = scopeBinding;
    }
    async create(pluginId, dto) {
        const routes = this.assertIngressCapable(pluginId);
        try {
            const inst = await this.instances.create(pluginId, dto.instanceId, {
                sessionScope: dto.sessionScope,
                verifyToken: dto.verifyToken,
                secret: dto.secret,
                config: dto.config,
            });
            void this.audit.logInfo(audit_log_entity_1.AuditAction.INTEGRATION_INSTANCE_CREATED, {
                metadata: { pluginId, instanceId: dto.instanceId },
            });
            await this.scopeBinding.applyScopeBinding(pluginId, inst.sessionScope, inst.config ?? {}, inst.enabled);
            return this.view(inst, routes, true);
        }
        catch (err) {
            if (err instanceof plugin_instance_service_1.InstanceExistsError)
                throw new common_1.ConflictException(err.message);
            throw err;
        }
    }
    async list(pluginId) {
        const routes = this.pluginRoutes(pluginId);
        const rows = await this.instances.list(pluginId);
        return rows.map(r => this.view(r, routes, false));
    }
    async getOne(pluginId, instanceId) {
        const inst = await this.instances.resolve(pluginId, instanceId);
        if (!inst)
            throw new common_1.NotFoundException('instance not found');
        return this.view(inst, this.pluginRoutes(pluginId), false);
    }
    async regenerate(pluginId, instanceId) {
        if (!(await this.instances.resolve(pluginId, instanceId)))
            throw new common_1.NotFoundException('instance not found');
        const inst = await this.instances.regenerateSecret(pluginId, instanceId);
        void this.audit.logInfo(audit_log_entity_1.AuditAction.INTEGRATION_INSTANCE_SECRET_REGENERATED, {
            metadata: { pluginId, instanceId },
        });
        return this.view(inst, this.pluginRoutes(pluginId), true);
    }
    async patch(pluginId, instanceId, dto) {
        let inst = await this.instances.resolve(pluginId, instanceId);
        if (!inst)
            throw new common_1.NotFoundException('instance not found');
        const previousScope = inst.sessionScope;
        if (dto.enabled !== undefined)
            inst = await this.instances.setEnabled(pluginId, instanceId, dto.enabled);
        if (dto.sessionScope !== undefined || dto.config !== undefined) {
            inst = await this.instances.update(pluginId, instanceId, { sessionScope: dto.sessionScope, config: dto.config }, this.schemaFor(pluginId));
        }
        const updated = inst;
        if (previousScope !== updated.sessionScope) {
            await this.scopeBinding.applyScopeBinding(pluginId, previousScope, {}, false);
        }
        await this.scopeBinding.applyScopeBinding(pluginId, updated.sessionScope, updated.config ?? {}, updated.enabled);
        return this.view(updated, this.pluginRoutes(pluginId), false);
    }
    async remove(pluginId, instanceId) {
        const inst = await this.instances.resolve(pluginId, instanceId);
        if (!inst)
            throw new common_1.NotFoundException('instance not found');
        const scope = inst.sessionScope;
        await this.instances.remove(pluginId, instanceId);
        await this.scopeBinding.applyScopeBinding(pluginId, scope, {}, false);
        void this.audit.logInfo(audit_log_entity_1.AuditAction.INTEGRATION_INSTANCE_DELETED, { metadata: { pluginId, instanceId } });
    }
    assertIngressCapable(pluginId) {
        const plugin = this.loader.getPlugin(pluginId);
        if (!plugin)
            throw new common_1.NotFoundException(`plugin ${pluginId} not found`);
        const routes = plugin.manifest.ingress?.map(r => r.route) ?? [];
        const hasPerm = (plugin.manifest.permissions ?? []).includes('webhook:ingress');
        if (routes.length === 0 || !hasPerm) {
            throw new common_1.BadRequestException(`plugin ${pluginId} is not ingress-capable`);
        }
        return routes;
    }
    pluginRoutes(pluginId) {
        return this.loader.getPlugin(pluginId)?.manifest.ingress?.map(r => r.route) ?? [];
    }
    schemaFor(pluginId) {
        return this.loader.getPlugin(pluginId)?.manifest.configSchema;
    }
    view(inst, routes, reveal) {
        const schema = this.loader.getPlugin(inst.pluginId)?.manifest.configSchema;
        const masked = reveal ? inst : this.instances.maskedView(inst, schema);
        return {
            id: masked.id,
            pluginId: masked.pluginId,
            instanceId: masked.instanceId,
            sessionScope: masked.sessionScope,
            secret: masked.secret,
            verifyToken: reveal ? inst.verifyToken : inst.verifyToken ? '***' : null,
            config: masked.config,
            enabled: masked.enabled,
            createdAt: masked.createdAt,
            updatedAt: masked.updatedAt,
            ingressUrls: (0, ingress_url_1.buildIngressUrls)(process.env.BASE_URL, inst.pluginId, inst.instanceId, routes),
        };
    }
};
exports.IntegrationInstanceController = IntegrationInstanceController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(201),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Instance created. The plaintext ingress secret and verifyToken are revealed once in this response — store them immediately (both masked on every later read).',
        type: instance_dto_1.InstanceView,
    }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, instance_dto_1.CreateInstanceDto]),
    __metadata("design:returntype", Promise)
], IntegrationInstanceController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Instances for the plugin (secrets masked).', type: [instance_dto_1.InstanceView] }),
    __param(0, (0, common_1.Param)('pluginId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IntegrationInstanceController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':instanceId'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'The instance (secret masked).', type: instance_dto_1.InstanceView }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], IntegrationInstanceController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(':instanceId/regenerate-secret'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Secret regenerated. The new plaintext secret is revealed once in this response; the verifyToken is also shown (unchanged).',
        type: instance_dto_1.InstanceView,
    }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], IntegrationInstanceController.prototype, "regenerate", null);
__decorate([
    (0, common_1.Patch)(':instanceId'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Instance updated (secret masked).', type: instance_dto_1.InstanceView }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Param)('instanceId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, instance_dto_1.UpdateInstanceDto]),
    __metadata("design:returntype", Promise)
], IntegrationInstanceController.prototype, "patch", null);
__decorate([
    (0, common_1.Delete)(':instanceId'),
    (0, common_1.HttpCode)(204),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Instance deleted and its session scope torn down.' }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], IntegrationInstanceController.prototype, "remove", null);
exports.IntegrationInstanceController = IntegrationInstanceController = __decorate([
    (0, swagger_1.ApiTags)('integration'),
    (0, common_1.Controller)('integration/plugins/:pluginId/instances'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    __metadata("design:paramtypes", [plugin_instance_service_1.PluginInstanceService,
        plugin_loader_service_1.PluginLoaderService,
        audit_service_1.AuditService,
        scope_binding_service_1.ScopeBindingService])
], IntegrationInstanceController);
//# sourceMappingURL=integration-instance.controller.js.map