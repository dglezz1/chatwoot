"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const worker_capability_1 = require("./worker-capability");
const worker_hooks_1 = require("./worker-hooks");
const worker_webhooks_1 = require("./worker-webhooks");
const port = worker_threads_1.parentPort;
if (!port) {
    throw new Error('worker-bootstrap must be run as a worker thread');
}
const send = (message) => port.postMessage(message);
const errorMessage = (error) => (error instanceof Error ? error.message : String(error));
const capClient = new worker_capability_1.WorkerCapabilityClient(send);
const hookRegistry = new worker_hooks_1.WorkerHookRegistry(send);
const webhookRegistry = new worker_webhooks_1.WebhookRegistry(send);
const logger = {
    log: (message, meta) => send({ kind: 'log', level: 'log', message, meta }),
    debug: (message, meta) => send({ kind: 'log', level: 'debug', message, meta }),
    warn: (message, meta) => send({ kind: 'log', level: 'warn', message, meta }),
    error: (message, error, meta) => send({
        kind: 'log',
        level: 'error',
        message,
        meta: error !== undefined ? { ...meta, error: errorMessage(error) } : meta,
    }),
};
let plugin = null;
let context = null;
let baseConfig = {};
port.on('message', (message) => {
    if (message.kind === 'cap-result') {
        capClient.handleResult(message);
        return;
    }
    if (message.kind === 'hook') {
        void hookRegistry.handleHook(message);
        return;
    }
    if (message.kind === 'webhook') {
        void webhookRegistry.handleWebhook(message);
        return;
    }
    void handle(message);
});
async function handle(message) {
    if (message.kind === 'load') {
        try {
            const mod = require(message.mainPath);
            const PluginCtor = mod.default ?? mod;
            plugin = new PluginCtor();
            const staticContext = message.context ?? { pluginId: 'unknown', config: {} };
            baseConfig = staticContext.config;
            context = {
                pluginId: staticContext.pluginId,
                get config() {
                    return worker_hooks_1.hookConfigStore.getStore()?.config ?? baseConfig;
                },
                logger,
                ...(0, worker_capability_1.buildSandboxContext)(capClient),
                registerHook: (event, handler, priority) => hookRegistry.register(event, handler, priority),
                registerWebhook: (route, handler) => webhookRegistry.register(route, handler),
            };
            send({ kind: 'ready' });
        }
        catch (error) {
            send({ kind: 'error', error: errorMessage(error) });
        }
        return;
    }
    if (message.kind === 'lifecycle') {
        try {
            await plugin?.[message.method]?.(context);
            send({ kind: 'lifecycle-result', id: message.id, ok: true });
        }
        catch (error) {
            send({ kind: 'lifecycle-result', id: message.id, ok: false, error: errorMessage(error) });
        }
        return;
    }
    if (message.kind === 'config-change') {
        baseConfig = message.config;
        void Promise.resolve(plugin?.onConfigChange?.(context, message.config)).catch(error => logger.error('onConfigChange threw', error));
        return;
    }
    if (message.kind === 'health-check') {
        try {
            const result = plugin?.healthCheck
                ? (await plugin.healthCheck())
                : { healthy: true, message: 'Plugin does not implement health check' };
            send({ kind: 'health-result', id: message.id, healthy: result.healthy, message: result.message });
        }
        catch (error) {
            send({ kind: 'health-result', id: message.id, healthy: false, message: errorMessage(error) });
        }
    }
}
//# sourceMappingURL=worker-bootstrap.js.map