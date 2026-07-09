"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginWorkerHost = void 0;
class PluginWorkerHost {
    channel;
    capDispatcher;
    onHookSubscribe;
    onWebhookSubscribe;
    onLog;
    runWithHookGuard;
    maxInFlightCaps;
    nextId = 1;
    ready = false;
    dead = false;
    readyWaiters = [];
    pending = new Map();
    hookPending = new Map();
    webhookPending = new Map();
    healthPending = new Map();
    inFlightHookEvents = new Map();
    inFlightCaps = 0;
    constructor(channel, capDispatcher, onHookSubscribe, onWebhookSubscribe, onLog, runWithHookGuard, maxInFlightCaps) {
        this.channel = channel;
        this.capDispatcher = capDispatcher;
        this.onHookSubscribe = onHookSubscribe;
        this.onWebhookSubscribe = onWebhookSubscribe;
        this.onLog = onLog;
        this.runWithHookGuard = runWithHookGuard;
        this.maxInFlightCaps = maxInFlightCaps;
        this.channel.onMessage(message => this.handleMessage(message));
        this.channel.onExit(code => this.handleExit(code));
    }
    incInFlightHook(event) {
        this.inFlightHookEvents.set(event, (this.inFlightHookEvents.get(event) ?? 0) + 1);
    }
    decInFlightHook(event) {
        const count = this.inFlightHookEvents.get(event);
        if (count === undefined)
            return;
        if (count <= 1)
            this.inFlightHookEvents.delete(event);
        else
            this.inFlightHookEvents.set(event, count - 1);
    }
    dispatchHook(options) {
        const id = this.nextId++;
        this.incInFlightHook(options.event);
        return new Promise(resolve => {
            const settle = (result) => {
                this.decInFlightHook(options.event);
                resolve(result);
            };
            const timer = setTimeout(() => {
                this.hookPending.delete(id);
                options.onTimeout?.();
                settle({ continue: true });
            }, options.timeoutMs);
            this.hookPending.set(id, { resolve: settle, timer });
            this.channel.postMessage({
                kind: 'hook',
                id,
                event: options.event,
                data: options.data,
                sessionId: options.sessionId,
                source: options.source,
                config: options.config,
            });
        });
    }
    dispatchWebhook(options) {
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.webhookPending.delete(id);
                options.onTimeout?.();
                resolve({ ok: false, status: 504 });
            }, options.timeoutMs);
            this.webhookPending.set(id, { resolve, timer });
            this.channel.postMessage({
                kind: 'webhook',
                id,
                instanceId: options.instanceId,
                route: options.route,
                method: options.method,
                headers: options.headers,
                query: options.query,
                body: options.body,
                rawBody: options.rawBody,
                verified: options.verified,
                deliveryId: options.deliveryId,
                sessionId: options.sessionId,
                config: options.config,
            });
        });
    }
    load(mainPath, context, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (this.dead)
                return reject(new Error('plugin worker is no longer running'));
            if (this.ready)
                return resolve();
            const waiter = {
                resolve,
                reject,
            };
            if (timeoutMs !== undefined) {
                waiter.timer = setTimeout(() => {
                    const index = this.readyWaiters.indexOf(waiter);
                    if (index !== -1)
                        this.readyWaiters.splice(index, 1);
                    reject(new Error(`plugin worker load timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }
            this.readyWaiters.push(waiter);
            this.channel.postMessage(context ? { kind: 'load', mainPath, context } : { kind: 'load', mainPath });
        });
    }
    runLifecycle(method, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (this.dead)
                return reject(new Error('plugin worker is no longer running'));
            const id = this.nextId++;
            const entry = {
                resolve,
                reject,
            };
            if (timeoutMs !== undefined) {
                entry.timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new Error(`plugin worker lifecycle '${method}' timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }
            this.pending.set(id, entry);
            this.channel.postMessage({ kind: 'lifecycle', id, method });
        });
    }
    sendConfigChange(config) {
        if (this.dead)
            return;
        this.channel.postMessage({ kind: 'config-change', config });
    }
    healthCheck(timeoutMs) {
        if (this.dead)
            return Promise.resolve({ healthy: false, message: 'plugin worker is no longer running' });
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.healthPending.delete(id);
                resolve({ healthy: false, message: 'health check timed out' });
            }, timeoutMs);
            this.healthPending.set(id, { resolve, timer });
            this.channel.postMessage({ kind: 'health-check', id });
        });
    }
    terminate() {
        return this.channel.terminate();
    }
    handleMessage(message) {
        switch (message.kind) {
            case 'ready':
                this.ready = true;
                this.drain(this.readyWaiters, w => {
                    if (w.timer)
                        clearTimeout(w.timer);
                    w.resolve();
                });
                break;
            case 'error': {
                const error = new Error(message.error);
                this.drain(this.readyWaiters, w => {
                    if (w.timer)
                        clearTimeout(w.timer);
                    w.reject(error);
                });
                break;
            }
            case 'lifecycle-result': {
                const waiter = this.pending.get(message.id);
                if (!waiter)
                    return;
                this.pending.delete(message.id);
                if (waiter.timer)
                    clearTimeout(waiter.timer);
                if (message.ok)
                    waiter.resolve();
                else
                    waiter.reject(new Error(message.error));
                break;
            }
            case 'cap':
                void this.handleCapRequest(message);
                break;
            case 'hook-subscribe':
                this.onHookSubscribe?.(message.event, message.priority);
                break;
            case 'webhook-subscribe':
                this.onWebhookSubscribe?.(message.route);
                break;
            case 'log':
                this.onLog?.(message.level, message.message, message.meta);
                break;
            case 'hook-result': {
                const waiter = this.hookPending.get(message.id);
                if (!waiter)
                    return;
                this.hookPending.delete(message.id);
                clearTimeout(waiter.timer);
                const result = { continue: message.continue };
                if (message.data !== undefined)
                    result.data = message.data;
                waiter.resolve(result);
                break;
            }
            case 'webhook-result': {
                const waiter = this.webhookPending.get(message.id);
                if (!waiter)
                    return;
                this.webhookPending.delete(message.id);
                clearTimeout(waiter.timer);
                waiter.resolve({
                    ok: message.error == null,
                    status: message.status,
                    headers: message.headers,
                    body: message.body,
                    error: message.error,
                });
                break;
            }
            case 'health-result': {
                const waiter = this.healthPending.get(message.id);
                if (!waiter)
                    return;
                this.healthPending.delete(message.id);
                clearTimeout(waiter.timer);
                waiter.resolve({ healthy: message.healthy, message: message.message });
                break;
            }
        }
    }
    async handleCapRequest(message) {
        if (this.maxInFlightCaps !== undefined && this.inFlightCaps >= this.maxInFlightCaps) {
            this.channel.postMessage({
                kind: 'cap-result',
                id: message.id,
                ok: false,
                error: `capability call rejected: too many concurrent capability calls (limit ${this.maxInFlightCaps})`,
            });
            return;
        }
        if (!this.capDispatcher) {
            this.channel.postMessage({ kind: 'cap-result', id: message.id, ok: false, error: 'no capability dispatcher' });
            return;
        }
        this.inFlightCaps++;
        try {
            const dispatcher = this.capDispatcher;
            const run = () => dispatcher(message.verb, message.args);
            const inFlight = [...this.inFlightHookEvents.keys()];
            const result = this.runWithHookGuard && inFlight.length > 0 ? await this.runWithHookGuard(inFlight, run) : await run();
            this.channel.postMessage({ kind: 'cap-result', id: message.id, ok: true, result });
        }
        catch (error) {
            this.channel.postMessage({
                kind: 'cap-result',
                id: message.id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.inFlightCaps--;
        }
    }
    handleExit(code) {
        this.dead = true;
        const error = new Error(`plugin worker exited unexpectedly (code ${code})`);
        this.drain(this.readyWaiters, w => {
            if (w.timer)
                clearTimeout(w.timer);
            w.reject(error);
        });
        this.pending.forEach(waiter => {
            if (waiter.timer)
                clearTimeout(waiter.timer);
            waiter.reject(error);
        });
        this.pending.clear();
        this.healthPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ healthy: false, message: 'plugin worker exited' });
        });
        this.healthPending.clear();
        this.hookPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ continue: true });
        });
        this.hookPending.clear();
        this.webhookPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ ok: false, status: 502 });
        });
        this.webhookPending.clear();
    }
    drain(waiters, fn) {
        const current = waiters.splice(0, waiters.length);
        current.forEach(fn);
    }
}
exports.PluginWorkerHost = PluginWorkerHost;
//# sourceMappingURL=plugin-worker-host.js.map