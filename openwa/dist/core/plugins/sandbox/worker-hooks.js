"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerHookRegistry = exports.hookConfigStore = void 0;
const async_hooks_1 = require("async_hooks");
exports.hookConfigStore = new async_hooks_1.AsyncLocalStorage();
class WorkerHookRegistry {
    post;
    handlers = new Map();
    constructor(post) {
        this.post = post;
    }
    register(event, handler, priority = 100) {
        const list = this.handlers.get(event);
        if (list) {
            list.push({ handler, priority });
            list.sort((a, b) => a.priority - b.priority);
            return;
        }
        this.handlers.set(event, [{ handler, priority }]);
        this.post({ kind: 'hook-subscribe', event, priority });
    }
    async handleHook(message) {
        const run = () => this.dispatch(message);
        if (message.config !== undefined) {
            await exports.hookConfigStore.run({ config: message.config }, run);
        }
        else {
            await run();
        }
    }
    async dispatch(message) {
        const list = this.handlers.get(message.event) ?? [];
        let data = message.data;
        let shouldContinue = true;
        for (const { handler } of list) {
            try {
                const result = await handler({
                    event: message.event,
                    data,
                    sessionId: message.sessionId,
                    source: message.source,
                    timestamp: new Date(),
                });
                if (result.data !== undefined)
                    data = result.data;
                if (!result.continue) {
                    shouldContinue = false;
                    break;
                }
            }
            catch {
            }
        }
        this.post({ kind: 'hook-result', id: message.id, continue: shouldContinue, data });
    }
}
exports.WorkerHookRegistry = WorkerHookRegistry;
//# sourceMappingURL=worker-hooks.js.map