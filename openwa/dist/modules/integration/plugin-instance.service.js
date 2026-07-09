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
exports.PluginInstanceService = exports.InstanceExistsError = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const plugin_instance_entity_1 = require("./entities/plugin-instance.entity");
const redact_config_1 = require("../plugins/redact-config");
function normalizeSecret(supplied) {
    if (supplied === undefined)
        return (0, node_crypto_1.randomBytes)(32).toString('hex');
    const s = supplied.trim();
    if (s.length < 16) {
        throw new common_1.BadRequestException('instance secret must be a non-empty string of at least 16 characters');
    }
    return s;
}
class InstanceExistsError extends Error {
    constructor(pluginId, instanceId) {
        super(`instance ${instanceId} already exists for plugin ${pluginId}`);
        this.name = 'InstanceExistsError';
    }
}
exports.InstanceExistsError = InstanceExistsError;
let PluginInstanceService = class PluginInstanceService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async mint(pluginId, instanceId, opts) {
        const id = `${pluginId}:${instanceId}`;
        const existing = await this.repo.findOne({ where: { id } });
        if (existing)
            return existing;
        const inst = this.repo.create({
            id,
            pluginId,
            instanceId,
            sessionScope: opts.sessionScope || null,
            secret: normalizeSecret(opts.secret),
            verifyToken: opts.verifyToken ?? null,
            config: opts.config ?? null,
            enabled: true,
        });
        return this.repo.save(inst);
    }
    resolve(pluginId, instanceId) {
        return this.repo.findOne({ where: { id: `${pluginId}:${instanceId}` } });
    }
    maskedView(instance, schema) {
        return {
            ...instance,
            secret: redact_config_1.SECRET_SENTINEL,
            config: instance.config == null ? instance.config : (0, redact_config_1.redactSecretConfig)(instance.config, schema),
        };
    }
    async create(pluginId, instanceId, opts) {
        const id = `${pluginId}:${instanceId}`;
        if (await this.repo.findOne({ where: { id } }))
            throw new InstanceExistsError(pluginId, instanceId);
        const inst = this.repo.create({
            id,
            pluginId,
            instanceId,
            sessionScope: opts.sessionScope || null,
            secret: normalizeSecret(opts.secret),
            verifyToken: opts.verifyToken ?? null,
            config: opts.config ?? null,
            enabled: true,
        });
        return this.repo.save(inst);
    }
    list(pluginId) {
        return this.repo.find({ where: { pluginId } });
    }
    listAll() {
        return this.repo.find();
    }
    async regenerateSecret(pluginId, instanceId) {
        const inst = await this.resolve(pluginId, instanceId);
        if (!inst)
            throw new Error(`instance ${instanceId} not found for plugin ${pluginId}`);
        inst.secret = (0, node_crypto_1.randomBytes)(32).toString('hex');
        return this.repo.save(inst);
    }
    async setEnabled(pluginId, instanceId, enabled) {
        const inst = await this.resolve(pluginId, instanceId);
        if (!inst)
            return null;
        inst.enabled = enabled;
        return this.repo.save(inst);
    }
    async update(pluginId, instanceId, patch, schema) {
        const inst = await this.resolve(pluginId, instanceId);
        if (!inst)
            return null;
        if (patch.sessionScope !== undefined)
            inst.sessionScope = patch.sessionScope || null;
        if (patch.config !== undefined) {
            inst.config = (0, redact_config_1.restoreSecretConfig)(patch.config, inst.config ?? undefined, schema);
        }
        return this.repo.save(inst);
    }
    async remove(pluginId, instanceId) {
        const result = await this.repo.delete({ id: `${pluginId}:${instanceId}` });
        return (result.affected ?? 0) > 0;
    }
};
exports.PluginInstanceService = PluginInstanceService;
exports.PluginInstanceService = PluginInstanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(plugin_instance_entity_1.PluginInstance, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PluginInstanceService);
//# sourceMappingURL=plugin-instance.service.js.map