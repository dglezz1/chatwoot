"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginsService = void 0;
exports.isIngressCapable = isIngressCapable;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const plugins_1 = require("../../core/plugins");
const redact_config_1 = require("./redact-config");
const plugin_installer_1 = require("./plugin-installer");
const plugin_download_1 = require("./plugin-download");
const catalog_1 = require("./catalog");
const CATALOG_MAX_BYTES = 1 * 1024 * 1024;
function isIngressCapable(manifest) {
    return (manifest.ingress?.length ?? 0) > 0 && (manifest.permissions ?? []).includes('webhook:ingress');
}
let PluginsService = class PluginsService {
    pluginLoader;
    configService;
    constructor(pluginLoader, configService) {
        this.pluginLoader = pluginLoader;
        this.configService = configService;
    }
    opChains = new Map();
    serialize(id, op) {
        const prior = this.opChains.get(id) ?? Promise.resolve();
        const next = prior.catch(() => undefined).then(op);
        this.opChains.set(id, next);
        void next
            .catch(() => undefined)
            .finally(() => {
            if (this.opChains.get(id) === next)
                this.opChains.delete(id);
        });
        return next;
    }
    findAll() {
        const plugins = this.pluginLoader.getAllPlugins();
        return plugins.map(plugin => ({
            id: plugin.manifest.id,
            name: plugin.manifest.name,
            version: plugin.manifest.version,
            type: plugin.manifest.type,
            description: plugin.manifest.description,
            author: plugin.manifest.author,
            status: plugin.status,
            config: (0, redact_config_1.redactSecretConfig)(plugin.config, plugin.manifest.configSchema),
            builtIn: this.pluginLoader.isBuiltIn(plugin.manifest.id),
            provides: plugin.manifest.provides ?? [],
            ingressCapable: isIngressCapable(plugin.manifest),
            configSchema: plugin.manifest.configSchema,
            configUi: plugin.manifest.configUi,
            i18n: plugin.manifest.i18n,
            sessionConfig: this.redactSessionConfig(plugin.sessionConfig, plugin.manifest.configSchema),
            sessionScoped: plugin.manifest.sessionScoped !== false,
            activeSessions: plugin.activeSessions ?? ['*'],
            loadedAt: plugin.loadedAt?.toISOString(),
            enabledAt: plugin.enabledAt?.toISOString(),
            error: plugin.error,
        }));
    }
    findOne(id) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        return {
            id: plugin.manifest.id,
            name: plugin.manifest.name,
            version: plugin.manifest.version,
            type: plugin.manifest.type,
            description: plugin.manifest.description,
            author: plugin.manifest.author,
            status: plugin.status,
            config: (0, redact_config_1.redactSecretConfig)(plugin.config, plugin.manifest.configSchema),
            builtIn: this.pluginLoader.isBuiltIn(plugin.manifest.id),
            provides: plugin.manifest.provides ?? [],
            ingressCapable: isIngressCapable(plugin.manifest),
            configSchema: plugin.manifest.configSchema,
            configUi: plugin.manifest.configUi,
            i18n: plugin.manifest.i18n,
            sessionConfig: this.redactSessionConfig(plugin.sessionConfig, plugin.manifest.configSchema),
            sessionScoped: plugin.manifest.sessionScoped !== false,
            activeSessions: plugin.activeSessions ?? ['*'],
            loadedAt: plugin.loadedAt?.toISOString(),
            enabledAt: plugin.enabledAt?.toISOString(),
            error: plugin.error,
        };
    }
    enable(id) {
        return this.serialize(id, () => this.enableInner(id));
    }
    async enableInner(id) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        if (plugin.status === plugins_1.PluginStatus.ENABLED) {
            return { success: true, message: `Plugin ${id} is already enabled` };
        }
        try {
            await this.pluginLoader.enablePlugin(id);
            return { success: true, message: `Plugin ${id} enabled successfully` };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
    disable(id) {
        return this.serialize(id, () => this.disableInner(id));
    }
    async disableInner(id) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        if (plugin.status !== plugins_1.PluginStatus.ENABLED) {
            return { success: true, message: `Plugin ${id} is not enabled` };
        }
        try {
            await this.pluginLoader.disablePlugin(id);
            return { success: true, message: `Plugin ${id} disabled successfully` };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
    updateSessions(id, sessions, allowedSessions) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        if (allowedSessions && allowedSessions.length > 0) {
            const outOfScope = sessions.filter(s => s === '*' || !allowedSessions.includes(s));
            if (outOfScope.length > 0) {
                throw new common_1.ForbiddenException(`API key not authorized for session(s): ${outOfScope.join(', ')}`);
            }
        }
        try {
            this.pluginLoader.setPluginSessions(id, sessions);
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : String(error));
        }
        return this.findOne(id);
    }
    updateConfig(id, config) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        try {
            const merged = (0, redact_config_1.restoreSecretConfig)(config, plugin.config, plugin.manifest.configSchema);
            this.pluginLoader.updatePluginConfig(id, merged);
            return { success: true, message: `Plugin ${id} configuration updated` };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
    updateSessionConfig(id, sessionId, config) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        if (plugin.manifest.sessionScoped === false) {
            throw new common_1.BadRequestException(`Plugin ${id} is global (not session-scoped) and has no per-session config`);
        }
        try {
            const existing = plugin.sessionConfig?.[sessionId];
            const merged = (0, redact_config_1.restoreSecretConfig)(config, existing, plugin.manifest.configSchema);
            this.pluginLoader.setPluginSessionConfig(id, sessionId, merged);
            return { success: true, message: `Plugin ${id} configuration for session ${sessionId} updated` };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
    redactSessionConfig(sessionConfig, schema) {
        if (!sessionConfig)
            return undefined;
        return Object.fromEntries(Object.entries(sessionConfig).map(([sid, cfg]) => [sid, (0, redact_config_1.redactSecretConfig)(cfg, schema)]));
    }
    getConfigUiHtml(id) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        const entry = plugin.manifest.configUi?.entry;
        if (!entry || typeof entry !== 'string') {
            throw new common_1.NotFoundException(`Plugin ${id} has no config UI`);
        }
        const base = path.resolve(this.pluginLoader.getPluginsDir(), id);
        let file;
        try {
            file = (0, plugins_1.resolvePluginMainPath)(this.pluginLoader.getPluginsDir(), id, entry);
        }
        catch {
            throw new common_1.NotFoundException(`Config UI entry not found for plugin ${id}`);
        }
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
            throw new common_1.NotFoundException(`Config UI entry not found for plugin ${id}`);
        }
        const real = fs.realpathSync(file);
        const realBase = fs.realpathSync(base);
        if (real !== realBase && !real.startsWith(realBase + path.sep)) {
            throw new common_1.NotFoundException(`Config UI entry not found for plugin ${id}`);
        }
        return fs.readFileSync(real, 'utf-8');
    }
    install(file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('No plugin file uploaded');
        }
        const { manifest, entries } = (0, plugin_installer_1.parsePluginPackage)(file.buffer);
        if (this.pluginLoader.getPlugin(manifest.id)) {
            throw new common_1.ConflictException(`Plugin "${manifest.id}" is already installed`);
        }
        const dir = path.join(this.pluginLoader.getPluginsDir(), manifest.id);
        if (fs.existsSync(dir)) {
            throw new common_1.ConflictException(`A plugin directory "${manifest.id}" already exists`);
        }
        try {
            for (const entry of entries) {
                const dest = path.join(dir, entry.relPath);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.writeFileSync(dest, entry.data);
            }
            this.pluginLoader.loadPlugin(dir);
        }
        catch (error) {
            fs.rmSync(dir, { recursive: true, force: true });
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.BadRequestException(`Failed to install plugin: ${error instanceof Error ? error.message : String(error)}`);
        }
        return this.findOne(manifest.id);
    }
    async installFromUrl(url) {
        const maxBytes = this.configService.get('plugins.downloadMaxBytes') ?? 5 * 1024 * 1024;
        let buffer;
        try {
            buffer = await (0, plugin_download_1.fetchSafeBuffer)(url, { maxBytes });
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to download plugin from URL: ${error instanceof Error ? error.message : String(error)}`);
        }
        const { manifest } = (0, plugin_installer_1.parsePluginPackage)(buffer);
        return this.serialize(manifest.id, () => Promise.resolve(this.install({ buffer })));
    }
    async getCatalog() {
        const url = this.configService.get('plugins.catalogUrl');
        if (!url)
            return [];
        let raw;
        try {
            raw = await (0, plugin_download_1.fetchSafeBuffer)(url, { maxBytes: CATALOG_MAX_BYTES });
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to fetch plugin catalog: ${error instanceof Error ? error.message : String(error)}`);
        }
        let entries;
        try {
            const parsed = JSON.parse(raw.toString('utf8'));
            if (!Array.isArray(parsed))
                throw new Error('catalog is not a JSON array');
            entries = parsed;
        }
        catch (error) {
            throw new common_1.BadRequestException(`Invalid plugin catalog JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        const installed = this.pluginLoader.getAllPlugins().map(p => ({ id: p.manifest.id, version: p.manifest.version }));
        return (0, catalog_1.annotateCatalog)(entries, installed);
    }
    updatePackage(id, buffer) {
        return this.serialize(id, () => this.updatePackageInner(id, buffer));
    }
    async updatePackageInner(id, buffer) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        if (this.pluginLoader.isBuiltIn(id)) {
            throw new common_1.BadRequestException(`Cannot update built-in plugin ${id}`);
        }
        const { manifest, entries } = (0, plugin_installer_1.parsePluginPackage)(buffer);
        if (manifest.id !== id) {
            throw new common_1.BadRequestException(`Package id "${manifest.id}" does not match the plugin being updated ("${id}")`);
        }
        const wasEnabled = plugin.status === plugins_1.PluginStatus.ENABLED;
        const dir = path.join(this.pluginLoader.getPluginsDir(), id);
        const backup = path.join(this.pluginLoader.getPluginsDir(), `.${id}.bak`);
        await this.pluginLoader.unloadPlugin(id);
        fs.rmSync(backup, { recursive: true, force: true });
        fs.renameSync(dir, backup);
        try {
            for (const entry of entries) {
                const dest = path.join(dir, entry.relPath);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.writeFileSync(dest, entry.data);
            }
            this.pluginLoader.loadPlugin(dir);
            if (wasEnabled) {
                await this.pluginLoader.enablePlugin(id);
            }
            fs.rmSync(backup, { recursive: true, force: true });
        }
        catch (error) {
            await this.pluginLoader.unloadPlugin(id).catch(() => undefined);
            fs.rmSync(dir, { recursive: true, force: true });
            fs.renameSync(backup, dir);
            try {
                this.pluginLoader.loadPlugin(dir);
                if (wasEnabled)
                    await this.pluginLoader.enablePlugin(id);
            }
            catch {
            }
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.BadRequestException(`Failed to update plugin: ${error instanceof Error ? error.message : String(error)}`);
        }
        return this.findOne(id);
    }
    async updateFromUrl(id, url) {
        const maxBytes = this.configService.get('plugins.downloadMaxBytes') ?? 5 * 1024 * 1024;
        let buffer;
        try {
            buffer = await (0, plugin_download_1.fetchSafeBuffer)(url, { maxBytes });
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to download plugin from URL: ${error instanceof Error ? error.message : String(error)}`);
        }
        return this.updatePackage(id, buffer);
    }
    uninstall(id) {
        return this.serialize(id, () => this.uninstallInner(id));
    }
    async uninstallInner(id) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        try {
            await this.pluginLoader.uninstallPlugin(id);
            return { success: true, message: `Plugin ${id} uninstalled successfully` };
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : String(error));
        }
    }
    async healthCheck(id) {
        const plugin = this.pluginLoader.getPlugin(id);
        if (!plugin) {
            throw new common_1.NotFoundException(`Plugin ${id} not found`);
        }
        try {
            return await this.pluginLoader.checkPluginHealth(id);
        }
        catch (error) {
            return {
                healthy: false,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }
};
exports.PluginsService = PluginsService;
exports.PluginsService = PluginsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plugins_1.PluginLoaderService,
        config_1.ConfigService])
], PluginsService);
//# sourceMappingURL=plugins.service.js.map