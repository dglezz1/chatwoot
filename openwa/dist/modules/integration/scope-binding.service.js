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
exports.ScopeBindingService = void 0;
const common_1 = require("@nestjs/common");
const audit_log_entity_1 = require("../audit/entities/audit-log.entity");
const audit_service_1 = require("../audit/audit.service");
const plugin_loader_service_1 = require("../../core/plugins/plugin-loader.service");
const plugin_instance_service_1 = require("./plugin-instance.service");
const logger_service_1 = require("../../common/services/logger.service");
let ScopeBindingService = class ScopeBindingService {
    instances;
    loader;
    audit;
    logger = (0, logger_service_1.createLogger)('ScopeBindingService');
    constructor(instances, loader, audit) {
        this.instances = instances;
        this.loader = loader;
        this.audit = audit;
    }
    async onApplicationBootstrap() {
        let rows;
        try {
            rows = await this.instances.listAll();
        }
        catch (err) {
            this.logger.error('Scope-binding reconciliation skipped (failed to list instances)', String(err));
            return;
        }
        rows.sort((a, b) => {
            const rank = (i) => (!i.sessionScope || i.sessionScope === '*' ? 1 : 0);
            if (rank(a) !== rank(b))
                return rank(a) - rank(b);
            return String(a.instanceId).localeCompare(String(b.instanceId));
        });
        let count = 0;
        for (const inst of rows) {
            if (!inst.enabled)
                continue;
            if (!this.loader.getPlugin(inst.pluginId))
                continue;
            await this.applyScopeBinding(inst.pluginId, inst.sessionScope, inst.config ?? {}, true);
            count++;
        }
        if (count > 0) {
            this.logger.log(`Reconciled scope bindings for ${count} enabled plugin instance(s)`, {
                action: 'scope_bindings_reconciled',
                count,
            });
        }
    }
    async applyScopeBinding(pluginId, scope, config, activate) {
        try {
            if (!scope || scope === '*') {
                if (activate) {
                    this.loader.updatePluginConfig(pluginId, config);
                    this.loader.setPluginSessions(pluginId, ['*']);
                    return;
                }
                const anyWildcardLeft = (await this.instances.list(pluginId)).some(i => i.enabled && (!i.sessionScope || i.sessionScope === '*'));
                if (!anyWildcardLeft) {
                    const current = this.loader.getPlugin(pluginId)?.activeSessions ?? [];
                    this.loader.setPluginSessions(pluginId, current.filter(s => s !== '*'));
                }
                return;
            }
            this.loader.setPluginSessionConfig(pluginId, scope, activate ? config : {});
            const current = this.loader.getPlugin(pluginId)?.activeSessions ?? [];
            const set = new Set(current.filter(s => s !== '*'));
            if (activate)
                set.add(scope);
            else
                set.delete(scope);
            this.loader.setPluginSessions(pluginId, [...set]);
        }
        catch (err) {
            void this.audit.logInfo(audit_log_entity_1.AuditAction.INTEGRATION_INSTANCE_UPDATED, {
                metadata: { pluginId, scope, bridgeError: String(err) },
            });
        }
    }
};
exports.ScopeBindingService = ScopeBindingService;
exports.ScopeBindingService = ScopeBindingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plugin_instance_service_1.PluginInstanceService,
        plugin_loader_service_1.PluginLoaderService,
        audit_service_1.AuditService])
], ScopeBindingService);
//# sourceMappingURL=scope-binding.service.js.map