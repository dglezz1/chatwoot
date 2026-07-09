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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLoaderService = void 0;
exports.resolvePluginMainPath = resolvePluginMainPath;
exports.buildSandboxWorkerEnv = buildSandboxWorkerEnv;
exports.dispatchConversationMedia = dispatchConversationMedia;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const wa_id_1 = require("../../engine/identity/wa-id");
const lid_mapping_store_service_1 = require("../../engine/identity/lid-mapping-store.service");
const async_hooks_1 = require("async_hooks");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_service_1 = require("../../common/services/logger.service");
const hooks_1 = require("../hooks");
const plugin_interfaces_1 = require("./plugin.interfaces");
const plugin_net_1 = require("./plugin-net");
const plugin_storage_service_1 = require("./plugin-storage.service");
const plugin_activation_1 = require("./plugin-activation");
const plugin_worker_host_1 = require("./sandbox/plugin-worker-host");
const worker_thread_channel_1 = require("./sandbox/worker-thread-channel");
const capability_router_1 = require("./sandbox/capability-router");
const conversation_send_facade_1 = require("./conversation-send-facade");
const handover_gate_1 = require("./handover-gate");
const webhook_subscribe_util_1 = require("./webhook-subscribe.util");
const integration_constants_1 = require("../../modules/integration/integration.constants");
const SANDBOX_MAX_OLD_GEN_MB = 256;
const SANDBOX_HOOK_TIMEOUT_MS = 5000;
const SANDBOX_HEALTH_TIMEOUT_MS = 5000;
const SANDBOX_LIFECYCLE_TIMEOUT_MS = 30000;
const SANDBOX_MAX_INFLIGHT_CAPS = 32;
const SANDBOX_ENV_ALLOWLIST = ['NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'TZ'];
function resolvePluginMainPath(pluginsDir, pluginId, main) {
    const base = path.resolve(pluginsDir, pluginId);
    const mainPath = path.resolve(base, main);
    if (mainPath !== base && !mainPath.startsWith(base + path.sep)) {
        throw new Error(`Plugin ${pluginId} main path escapes the plugin directory`);
    }
    return mainPath;
}
function buildSandboxWorkerEnv(source = process.env) {
    const env = {};
    for (const key of SANDBOX_ENV_ALLOWLIST) {
        if (source[key] !== undefined)
            env[key] = source[key];
    }
    env.NODE_ENV = source.NODE_ENV ?? 'production';
    return env;
}
function dispatchConversationMedia(svc, sessionId, opts) {
    const dto = { chatId: opts.chatId, url: opts.url, caption: opts.caption };
    switch (opts.type) {
        case 'image':
            return svc.sendImage(sessionId, dto);
        case 'video':
            return svc.sendVideo(sessionId, dto);
        case 'audio':
            return svc.sendAudio(sessionId, dto);
        case 'voice':
            return svc.sendAudio(sessionId, { ...dto, ptt: true });
        case 'file':
            return svc.sendDocument(sessionId, dto);
    }
}
let PluginLoaderService = class PluginLoaderService {
    configService;
    hookManager;
    pluginStorage;
    moduleRef;
    lidMappingStore;
    logger = (0, logger_service_1.createLogger)('PluginLoaderService');
    plugins = new Map();
    enabling = new Set();
    sandboxHosts = new Map();
    hookSession = new async_hooks_1.AsyncLocalStorage();
    pluginsDir;
    constructor(configService, hookManager, pluginStorage, moduleRef, lidMappingStore) {
        this.configService = configService;
        this.hookManager = hookManager;
        this.pluginStorage = pluginStorage;
        this.moduleRef = moduleRef;
        this.lidMappingStore = lidMappingStore;
        this.pluginsDir = this.configService.get('plugins.dir') ?? './plugins';
    }
    onModuleInit() {
        this.loadBuiltInPlugins();
        if (fs.existsSync(this.pluginsDir)) {
            this.loadPluginsFromDirectory(this.pluginsDir);
        }
        this.logger.log(`Loaded ${this.plugins.size} plugins`, {
            action: 'plugins_loaded',
            count: this.plugins.size,
        });
    }
    async onModuleDestroy() {
        const enabled = this.getAllPlugins().filter(p => p.status === plugin_interfaces_1.PluginStatus.ENABLED);
        for (const plugin of enabled) {
            try {
                await this.disablePlugin(plugin.manifest.id);
            }
            catch (error) {
                this.logger.error(`Failed to disable plugin ${plugin.manifest.id} during shutdown`, error instanceof Error ? error.message : String(error), { pluginId: plugin.manifest.id, action: 'plugin_shutdown_disable_failed' });
            }
        }
    }
    loadBuiltInPlugins() {
        this.logger.debug('Built-in plugins loading point (Phase 4)', {
            action: 'builtin_plugins_init',
        });
    }
    loadPluginsFromDirectory(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.'))
                continue;
            const pluginPath = path.join(dir, entry.name);
            const manifestPath = path.join(pluginPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                this.logger.warn(`Plugin ${entry.name} missing manifest.json`, {
                    pluginPath,
                    action: 'manifest_missing',
                });
                continue;
            }
            try {
                this.loadPlugin(pluginPath);
            }
            catch (error) {
                this.logger.error(`Failed to load plugin ${entry.name}`, error instanceof Error ? error.message : String(error), { pluginPath, action: 'plugin_load_failed' });
            }
        }
    }
    loadPlugin(pluginPath) {
        const manifestPath = path.join(pluginPath, 'manifest.json');
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        if (!manifest.id || !manifest.name || !manifest.version || !manifest.type || !manifest.main) {
            throw new Error(`Invalid manifest: missing required fields`);
        }
        (0, plugin_interfaces_1.validateIngressManifest)(manifest);
        if (this.plugins.has(manifest.id)) {
            throw new Error(`Plugin ${manifest.id} is already loaded`);
        }
        const storedConfig = this.pluginStorage.getPluginConfig(manifest.id) ?? {};
        const storedSessions = this.pluginStorage.getPluginSessions(manifest.id) ?? undefined;
        const storedSessionConfig = this.pluginStorage.getPluginSessionConfig(manifest.id) ?? undefined;
        const pluginInstance = {
            manifest,
            status: plugin_interfaces_1.PluginStatus.INSTALLED,
            config: storedConfig,
            instance: null,
            loadedAt: new Date(),
            builtIn: false,
            activeSessions: storedSessions,
            sessionConfig: storedSessionConfig,
        };
        this.plugins.set(manifest.id, pluginInstance);
        this.ensureRegistryEntry(manifest, false);
        this.logger.log(`Plugin loaded: ${manifest.name} v${manifest.version}`, {
            pluginId: manifest.id,
            type: manifest.type,
            action: 'plugin_loaded',
        });
        return pluginInstance;
    }
    ensureRegistryEntry(manifest, builtIn) {
        const existing = this.pluginStorage.getPluginEntry(manifest.id);
        this.pluginStorage.setPluginEntry({
            id: manifest.id,
            type: manifest.type,
            name: manifest.name,
            version: manifest.version,
            status: plugin_interfaces_1.PluginStatus.INSTALLED,
            config: existing?.config ?? {},
            builtIn,
            installedAt: existing?.installedAt ?? new Date(),
            updatedAt: new Date(),
            activeSessions: existing?.activeSessions,
            sessionConfig: existing?.sessionConfig,
        });
    }
    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.status === plugin_interfaces_1.PluginStatus.ENABLED) {
            return;
        }
        if (plugin.manifest.type === plugin_interfaces_1.PluginType.ENGINE) {
            const activeEngine = this.configService.get('engine.type') ?? 'whatsapp-web.js';
            if (pluginId !== activeEngine) {
                throw new Error(`Engine "${pluginId}" is not the active engine ("${activeEngine}"). Set engine.type and restart to switch engines.`);
            }
        }
        if (this.enabling.has(pluginId)) {
            throw new Error(`Plugin ${pluginId} is already being enabled`);
        }
        this.enabling.add(pluginId);
        try {
            if (plugin.builtIn === false) {
                await this.enableSandboxed(pluginId, plugin);
            }
            else {
                await this.enableInProcess(pluginId, plugin);
            }
            plugin.status = plugin_interfaces_1.PluginStatus.ENABLED;
            plugin.enabledAt = new Date();
            plugin.error = undefined;
            this.pluginStorage.setPluginStatus(pluginId, plugin_interfaces_1.PluginStatus.ENABLED);
            this.logger.log(`Plugin enabled: ${plugin.manifest.name}`, {
                pluginId,
                action: 'plugin_enabled',
            });
        }
        catch (error) {
            plugin.status = plugin_interfaces_1.PluginStatus.ERROR;
            plugin.error = error instanceof Error ? error.message : String(error);
            this.pluginStorage.setPluginStatus(pluginId, plugin_interfaces_1.PluginStatus.ERROR);
            this.hookManager.unregisterPlugin(pluginId);
            throw error;
        }
        finally {
            this.enabling.delete(pluginId);
        }
    }
    async disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.status !== plugin_interfaces_1.PluginStatus.ENABLED) {
            return;
        }
        try {
            const host = this.sandboxHosts.get(pluginId);
            if (host) {
                try {
                    await host.runLifecycle('onDisable', SANDBOX_LIFECYCLE_TIMEOUT_MS);
                }
                catch (error) {
                    this.logger.warn(`Sandboxed plugin ${pluginId} onDisable failed during disable; terminating anyway`, {
                        pluginId,
                        action: 'sandbox_disable_lifecycle_failed',
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
                await host.terminate().catch(() => undefined);
                this.sandboxHosts.delete(pluginId);
            }
            else {
                const context = this.createPluginContext(plugin);
                if (plugin.instance?.onDisable) {
                    await plugin.instance.onDisable(context);
                }
            }
            this.hookManager.unregisterPlugin(pluginId);
            plugin.status = plugin_interfaces_1.PluginStatus.DISABLED;
            this.pluginStorage.setPluginStatus(pluginId, plugin_interfaces_1.PluginStatus.DISABLED);
            this.logger.log(`Plugin disabled: ${plugin.manifest.name}`, {
                pluginId,
                action: 'plugin_disabled',
            });
        }
        catch (error) {
            plugin.status = plugin_interfaces_1.PluginStatus.ERROR;
            plugin.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.status === plugin_interfaces_1.PluginStatus.ENABLED) {
            await this.disablePlugin(pluginId);
        }
        if (plugin.instance?.onUnload) {
            const context = this.createPluginContext(plugin);
            await plugin.instance.onUnload(context);
        }
        this.plugins.delete(pluginId);
        this.logger.log(`Plugin unloaded: ${plugin.manifest.name}`, {
            pluginId,
            action: 'plugin_unloaded',
        });
    }
    getPluginsDir() {
        return this.pluginsDir;
    }
    isBuiltIn(pluginId) {
        return this.pluginStorage.getPluginEntry(pluginId)?.builtIn ?? false;
    }
    async uninstallPlugin(pluginId) {
        if (this.pluginStorage.getPluginEntry(pluginId)?.builtIn) {
            throw new Error(`Cannot uninstall built-in plugin ${pluginId}`);
        }
        if (this.plugins.has(pluginId)) {
            await this.unloadPlugin(pluginId);
        }
        this.pluginStorage.deletePluginEntry(pluginId);
        const base = path.resolve(this.pluginsDir);
        const dir = path.resolve(base, pluginId);
        if (dir !== base && dir.startsWith(base + path.sep) && fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        this.logger.log(`Plugin uninstalled: ${pluginId}`, { pluginId, action: 'plugin_uninstalled' });
    }
    updatePluginConfig(pluginId, config) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        plugin.config = { ...plugin.config, ...config };
        this.pluginStorage.setPluginConfig(pluginId, plugin.config);
        if (plugin.status === plugin_interfaces_1.PluginStatus.ENABLED) {
            const sandboxHost = this.sandboxHosts.get(pluginId);
            if (sandboxHost) {
                sandboxHost.sendConfigChange(plugin.config);
            }
            else if (plugin.instance?.onConfigChange) {
                const context = this.createPluginContext(plugin);
                void plugin.instance.onConfigChange(context, plugin.config);
            }
        }
        this.logger.debug(`Plugin config updated: ${pluginId}`, {
            pluginId,
            action: 'plugin_config_updated',
        });
    }
    setPluginSessions(pluginId, sessions) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.manifest.sessionScoped === false) {
            throw new Error(`Plugin ${pluginId} is global (not session-scoped) and cannot be activated per session`);
        }
        plugin.activeSessions = sessions;
        this.pluginStorage.setPluginSessions(pluginId, sessions);
        this.logger.log(`Plugin active sessions updated: ${pluginId}`, {
            pluginId,
            action: 'plugin_sessions_updated',
            sessions,
        });
        return plugin;
    }
    setPluginSessionConfig(pluginId, sessionId, config) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        if (plugin.manifest.sessionScoped === false) {
            throw new Error(`Plugin ${pluginId} is global (not session-scoped) and has no per-session config`);
        }
        const next = { ...(plugin.sessionConfig ?? {}) };
        if (config && Object.keys(config).length > 0) {
            next[sessionId] = config;
        }
        else {
            delete next[sessionId];
        }
        plugin.sessionConfig = next;
        this.pluginStorage.setPluginSessionConfig(pluginId, next);
        this.logger.debug(`Plugin session config updated: ${pluginId}`, {
            pluginId,
            action: 'plugin_session_config_updated',
            sessionId,
        });
        return plugin;
    }
    async checkPluginHealth(pluginId) {
        const sandboxHost = this.sandboxHosts.get(pluginId);
        if (sandboxHost) {
            return sandboxHost.healthCheck(SANDBOX_HEALTH_TIMEOUT_MS);
        }
        const plugin = this.plugins.get(pluginId);
        if (plugin?.instance?.healthCheck) {
            return plugin.instance.healthCheck();
        }
        return { healthy: true, message: 'Plugin does not implement health check' };
    }
    async dispatchWebhookForInstance(d) {
        const host = this.sandboxHosts.get(d.pluginId);
        if (!host) {
            throw new Error('no live sandbox host for plugin ' + d.pluginId);
        }
        const plugin = this.plugins.get(d.pluginId);
        const instance = await this.getPluginInstanceService().resolve(d.pluginId, d.instanceId);
        const config = plugin
            ? (0, plugin_activation_1.resolvePluginConfig)(plugin.config, plugin.sessionConfig, instance?.sessionScope ?? undefined, plugin.manifest.sessionScoped !== false)
            : undefined;
        const result = await host.dispatchWebhook({
            instanceId: d.instanceId,
            route: d.route,
            method: 'POST',
            headers: d.payload.headers,
            query: d.payload.query,
            body: d.payload.body,
            rawBody: d.payload.rawBody,
            verified: true,
            deliveryId: d.deliveryId,
            sessionId: d.sessionId,
            config,
            timeoutMs: integration_constants_1.INGRESS_DISPATCH_TIMEOUT_MS,
        });
        if (!result.ok) {
            throw new Error(result.error ?? 'ingress dispatch failed with status ' + result.status);
        }
    }
    getMessageService() {
        const mod = require('../../modules/message/message.service');
        return this.moduleRef.get(mod.MessageService, { strict: false });
    }
    getSessionService() {
        const mod = require('../../modules/session/session.service');
        return this.moduleRef.get(mod.SessionService, { strict: false });
    }
    getConversationMappingService() {
        const mod = require('../../modules/integration/conversation-mapping.service');
        return this.moduleRef.get(mod.ConversationMappingService, { strict: false });
    }
    getPluginInstanceService() {
        const mod = require('../../modules/integration/plugin-instance.service');
        return this.moduleRef.get(mod.PluginInstanceService, { strict: false });
    }
    assertPermission(manifest, permission) {
        if (!(manifest.permissions ?? []).includes(permission)) {
            throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${manifest.id} is missing the '${permission}' permission required for this capability`);
        }
    }
    assertSessionAllowed(manifest, sessionId) {
        const allowed = manifest.sessions ?? ['*'];
        if (!allowed.includes('*') && !allowed.includes(sessionId)) {
            throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${manifest.id} is not permitted to act on session ${sessionId}`);
        }
    }
    isHookActive(plugin, sessionId) {
        return (0, plugin_activation_1.isPluginActiveForSession)(plugin.manifest.sessionScoped ?? true, plugin.activeSessions ?? ['*'], sessionId);
    }
    assertSessionActive(plugin, sessionId) {
        this.assertSessionAllowed(plugin.manifest, sessionId);
        if (!this.isHookActive(plugin, sessionId)) {
            throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${plugin.manifest.id} is not activated for session ${sessionId}`);
        }
    }
    resolveEngine(plugin, sessionId) {
        this.assertSessionActive(plugin, sessionId);
        const engine = this.getSessionService().getEngine(sessionId);
        if (!engine) {
            throw new plugin_interfaces_1.PluginCapabilityError(`Session ${sessionId} has no active engine (unknown or not started)`);
        }
        return engine;
    }
    resolveEngineRead(plugin, sessionId) {
        this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.ENGINE_READ);
        return this.resolveEngine(plugin, sessionId);
    }
    createSandboxHost(capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard) {
        const workerEntry = path.join(__dirname, 'sandbox', 'worker-bootstrap.js');
        return new plugin_worker_host_1.PluginWorkerHost(new worker_thread_channel_1.WorkerThreadChannel({
            workerEntry,
            maxOldGenerationSizeMb: SANDBOX_MAX_OLD_GEN_MB,
            env: buildSandboxWorkerEnv(),
        }), capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, SANDBOX_MAX_INFLIGHT_CAPS);
    }
    async enableInProcess(pluginId, plugin) {
        const context = this.createPluginContext(plugin);
        if (!plugin.instance) {
            const mainPath = resolvePluginMainPath(this.pluginsDir, pluginId, plugin.manifest.main);
            const pluginModule = require(mainPath);
            if (pluginModule.default) {
                plugin.instance = new pluginModule.default();
            }
            else {
                throw new Error(`Plugin ${pluginId} does not export a default class`);
            }
        }
        if (plugin.instance.onLoad) {
            await plugin.instance.onLoad(context);
        }
        if (plugin.instance.onEnable) {
            await plugin.instance.onEnable(context);
        }
    }
    async enableSandboxed(pluginId, plugin) {
        const mainPath = resolvePluginMainPath(this.pluginsDir, pluginId, plugin.manifest.main);
        const context = this.createPluginContext(plugin);
        const subscribedEvents = new Set();
        let unknownEventWarned = false;
        const onHookSubscribe = (event, priority) => {
            if (!(0, hooks_1.isKnownHookEvent)(event)) {
                if (!unknownEventWarned) {
                    unknownEventWarned = true;
                    this.logger.warn(`Sandboxed plugin ${pluginId} subscribed to an unknown hook event; ignoring`, {
                        pluginId,
                        event,
                        action: 'sandbox_unknown_hook_event',
                    });
                }
                return;
            }
            if (subscribedEvents.has(event))
                return;
            if (subscribedEvents.size >= hooks_1.KNOWN_HOOK_EVENTS.size)
                return;
            subscribedEvents.add(event);
            this.hookManager.register(pluginId, event, async (hookCtx) => {
                const liveHost = this.sandboxHosts.get(pluginId);
                if (!liveHost)
                    return { continue: true };
                if (!this.isHookActive(plugin, hookCtx.sessionId))
                    return { continue: true };
                if (event === 'message:received') {
                    try {
                        const chatId = hookCtx.data?.chatId;
                        if (chatId && hookCtx.sessionId) {
                            const handover = await this.getConversationMappingService().findHandoverForChat(hookCtx.sessionId, chatId);
                            if (!(0, handover_gate_1.shouldDispatchToPlugin)(handover, pluginId))
                                return { continue: true };
                        }
                    }
                    catch (error) {
                        this.logger.debug(`Handover gate lookup failed for plugin ${pluginId}; dispatching normally`, {
                            pluginId,
                            event,
                            error: error instanceof Error ? error.message : String(error),
                            action: 'handover_gate_fail_open',
                        });
                    }
                }
                return liveHost
                    .dispatchHook({
                    event,
                    data: hookCtx.data,
                    sessionId: hookCtx.sessionId,
                    source: hookCtx.source,
                    config: (0, plugin_activation_1.resolvePluginConfig)(plugin.config, plugin.sessionConfig, hookCtx.sessionId, plugin.manifest.sessionScoped !== false),
                    timeoutMs: SANDBOX_HOOK_TIMEOUT_MS,
                    onTimeout: () => this.logger.warn(`Sandboxed plugin ${pluginId} hook '${event}' timed out`, {
                        pluginId,
                        event,
                        action: 'sandbox_hook_timeout',
                    }),
                })
                    .then(result => ({ continue: result.continue, data: result.data }));
            }, priority);
        };
        const subscribedRoutes = new Set();
        const declaredRoutes = new Set((plugin.manifest.ingress ?? []).map(r => r.route));
        const onWebhookSubscribe = (0, webhook_subscribe_util_1.makeOnWebhookSubscribe)({
            pluginId,
            declaredRoutes,
            hasPermission: (plugin.manifest.permissions ?? []).includes(plugin_interfaces_1.PluginCapabilityPermission.WEBHOOK_INGRESS),
            subscribed: subscribedRoutes,
            maxRoutes: declaredRoutes.size,
            warn: (message, meta) => this.logger.warn(message, meta),
        });
        const onLog = (level, message, meta) => {
            if (level === 'error')
                context.logger.error(message, undefined, meta);
            else
                context.logger[level](message, meta);
        };
        const host = this.createSandboxHost((verb, args) => (0, capability_router_1.dispatchCapabilityVerb)(context, verb, args), onHookSubscribe, onWebhookSubscribe, onLog, (events, run) => this.hookManager.runInFlight(events, run));
        this.sandboxHosts.set(pluginId, host);
        try {
            await host.load(mainPath, { pluginId, config: plugin.config }, SANDBOX_LIFECYCLE_TIMEOUT_MS);
            await host.runLifecycle('onLoad', SANDBOX_LIFECYCLE_TIMEOUT_MS);
            await host.runLifecycle('onEnable', SANDBOX_LIFECYCLE_TIMEOUT_MS);
        }
        catch (error) {
            this.sandboxHosts.delete(pluginId);
            await host.terminate().catch(() => undefined);
            throw error;
        }
    }
    createPluginContext(plugin) {
        const pluginLogger = {
            log: (message, meta) => this.logger.log(`[${plugin.manifest.id}] ${message}`, { ...meta, pluginId: plugin.manifest.id }),
            debug: (message, meta) => this.logger.debug(`[${plugin.manifest.id}] ${message}`, { ...meta, pluginId: plugin.manifest.id }),
            warn: (message, meta) => this.logger.warn(`[${plugin.manifest.id}] ${message}`, { ...meta, pluginId: plugin.manifest.id }),
            error: (message, error, meta) => this.logger.error(`[${plugin.manifest.id}] ${message}`, error instanceof Error ? error.message : String(error), { ...meta, pluginId: plugin.manifest.id }),
        };
        const hookSession = this.hookSession;
        return {
            pluginId: plugin.manifest.id,
            manifest: plugin.manifest,
            get config() {
                return (0, plugin_activation_1.resolvePluginConfig)(plugin.config, plugin.sessionConfig, hookSession.getStore()?.sessionId, plugin.manifest.sessionScoped !== false);
            },
            hookManager: this.hookManager,
            logger: pluginLogger,
            storage: this.pluginStorage.createPluginStorage(plugin.manifest.id),
            registerHook: (event, handler, priority) => {
                this.hookManager.register(plugin.manifest.id, event, async (hookCtx) => {
                    if (!this.isHookActive(plugin, hookCtx.sessionId))
                        return { continue: true };
                    return this.hookSession.run({ sessionId: hookCtx.sessionId }, () => handler(hookCtx));
                }, priority);
            },
            registerWebhook: () => {
                throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${plugin.manifest.id}: registerWebhook (ingress) is only available to sandboxed plugins`);
            },
            messages: {
                sendText: async (sessionId, chatId, text) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.MESSAGES_SEND);
                    this.resolveEngine(plugin, sessionId);
                    return this.getMessageService().sendText(sessionId, { chatId, text });
                },
                reply: async (sessionId, chatId, quotedMessageId, text) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.MESSAGES_SEND);
                    this.resolveEngine(plugin, sessionId);
                    return this.getMessageService().reply(sessionId, { chatId, quotedMessageId, text });
                },
            },
            engine: {
                getGroupInfo: async (sessionId, groupId) => this.resolveEngineRead(plugin, sessionId).getGroupInfo(groupId),
                getContacts: async (sessionId) => this.resolveEngineRead(plugin, sessionId).getContacts(),
                getContactById: async (sessionId, contactId) => this.resolveEngineRead(plugin, sessionId).getContactById(contactId),
                checkNumberExists: async (sessionId, phone) => this.resolveEngineRead(plugin, sessionId).checkNumberExists(phone),
                getChats: async (sessionId) => this.resolveEngineRead(plugin, sessionId).getChats(),
                getChatHistory: async (sessionId, chatId, limit, includeMedia) => this.resolveEngineRead(plugin, sessionId).getChatHistory(chatId, Math.min(Math.max(Math.trunc(limit ?? 50), 1), 100), includeMedia ?? false),
                canonicalChatId: (sessionId, chatId) => {
                    this.resolveEngineRead(plugin, sessionId);
                    return Promise.resolve((0, wa_id_1.toNeutralJid)(chatId, jid => this.lidMappingStore?.getCached((0, wa_id_1.userPart)(jid)) ?? null));
                },
            },
            net: {
                fetch: async (url, init) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.NET_FETCH);
                    const netConfigs = [plugin.config ?? {}, ...Object.values(plugin.sessionConfig ?? {})];
                    const allow = [
                        ...new Set(netConfigs.flatMap(cfg => (0, plugin_net_1.effectiveNetAllow)(plugin.manifest.net?.allow, plugin.manifest.net?.allowConfigHosts, cfg))),
                    ];
                    if (!(0, plugin_net_1.isNetHostAllowed)(allow, url)) {
                        throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${plugin.manifest.id} may not fetch ${url} — add its host to net.allow or net.allowConfigHosts`);
                    }
                    return (0, plugin_net_1.performPluginFetch)(url, init);
                },
            },
            conversations: (0, conversation_send_facade_1.buildConversationSendFacade)({
                manifest: plugin.manifest,
                assertPermission: this.assertPermission.bind(this),
                assertSessionActive: (sessionId) => this.assertSessionActive(plugin, sessionId),
                resolveChatId: async (env) => {
                    if (!env.instanceId || !env.source) {
                        throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${plugin.manifest.id}: conversation.send requires chatId, or both instanceId and source to resolve one`);
                    }
                    const mapping = await this.getConversationMappingService().getByProvider(plugin.manifest.id, env.instanceId, env.source.externalConversationId);
                    if (!mapping) {
                        throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${plugin.manifest.id}: no conversation mapping for instance ${env.instanceId} / ${env.source.externalConversationId}`);
                    }
                    return mapping.chatId;
                },
                runGuarded: (events, run) => events.some(e => this.hookManager.isInFlight(e))
                    ? this.hookManager.runInFlight(events, run)
                    : run(),
                sendText: (sessionId, opts) => this.getMessageService().sendText(sessionId, opts),
                reply: (sessionId, opts) => this.getMessageService().reply(sessionId, opts),
                sendMedia: (sessionId, opts) => dispatchConversationMedia(this.getMessageService(), sessionId, opts),
            }),
            handover: {
                set: async (key, state) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.CONVERSATION_SEND);
                    this.assertSessionActive(plugin, key.sessionId);
                    const mapping = await this.getConversationMappingService().get({
                        sessionId: key.sessionId,
                        chatId: key.chatId,
                        pluginId: plugin.manifest.id,
                        instanceId: key.instanceId,
                    });
                    if (!mapping) {
                        throw new plugin_interfaces_1.PluginCapabilityError(`Plugin ${plugin.manifest.id}: no conversation mapping for session ${key.sessionId} / chat ${key.chatId} / instance ${key.instanceId}`);
                    }
                    await this.getConversationMappingService().setHandover(mapping.id, state);
                },
            },
            mappings: {
                upsert: async (key, providerConversationId) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.CONVERSATION_SEND);
                    this.assertSessionActive(plugin, key.sessionId);
                    await this.getConversationMappingService().upsert({ sessionId: key.sessionId, chatId: key.chatId, pluginId: plugin.manifest.id, instanceId: key.instanceId }, providerConversationId);
                },
                get: async (key) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.CONVERSATION_SEND);
                    this.assertSessionActive(plugin, key.sessionId);
                    const m = await this.getConversationMappingService().get({
                        sessionId: key.sessionId,
                        chatId: key.chatId,
                        pluginId: plugin.manifest.id,
                        instanceId: key.instanceId,
                    });
                    return m ? { providerConversationId: m.providerConversationId, handoverState: m.handoverState } : null;
                },
                getByProvider: async (instanceId, providerConversationId) => {
                    this.assertPermission(plugin.manifest, plugin_interfaces_1.PluginCapabilityPermission.CONVERSATION_SEND);
                    const m = await this.getConversationMappingService().getByProvider(plugin.manifest.id, instanceId, providerConversationId);
                    if (m)
                        this.assertSessionActive(plugin, m.sessionId);
                    return m ? { sessionId: m.sessionId, chatId: m.chatId, handoverState: m.handoverState } : null;
                },
            },
        };
    }
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }
    getPluginsByType(type) {
        return this.getAllPlugins().filter(p => p.manifest.type === type);
    }
    getEnabledPlugins() {
        return this.getAllPlugins().filter(p => p.status === plugin_interfaces_1.PluginStatus.ENABLED);
    }
    isPluginEnabled(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin?.status === plugin_interfaces_1.PluginStatus.ENABLED;
    }
    registerBuiltInPlugin(manifest, instance, config = {}) {
        const effectiveConfig = { ...config, ...(this.pluginStorage.getPluginConfig(manifest.id) ?? {}) };
        const pluginInstance = {
            manifest,
            status: plugin_interfaces_1.PluginStatus.INSTALLED,
            config: effectiveConfig,
            instance,
            loadedAt: new Date(),
            builtIn: true,
            activeSessions: this.pluginStorage.getPluginSessions(manifest.id) ?? undefined,
            sessionConfig: this.pluginStorage.getPluginSessionConfig(manifest.id) ?? undefined,
        };
        this.plugins.set(manifest.id, pluginInstance);
        this.ensureRegistryEntry(manifest, true);
        this.logger.debug(`Built-in plugin registered: ${manifest.name}`, {
            pluginId: manifest.id,
            action: 'builtin_plugin_registered',
        });
    }
};
exports.PluginLoaderService = PluginLoaderService;
exports.PluginLoaderService = PluginLoaderService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        hooks_1.HookManager,
        plugin_storage_service_1.PluginStorageService,
        core_1.ModuleRef,
        lid_mapping_store_service_1.LidMappingStoreService])
], PluginLoaderService);
//# sourceMappingURL=plugin-loader.service.js.map