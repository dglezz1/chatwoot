"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyedAsyncLock = void 0;
exports.orderingKeyFor = orderingKeyFor;
class KeyedAsyncLock {
    tails = new Map();
    run(key, fn) {
        const prev = this.tails.get(key) ?? Promise.resolve();
        const next = prev.catch(() => undefined).then(fn);
        this.tails.set(key, next);
        void next
            .catch(() => undefined)
            .finally(() => {
            if (this.tails.get(key) === next)
                this.tails.delete(key);
        });
        return next;
    }
}
exports.KeyedAsyncLock = KeyedAsyncLock;
function orderingKeyFor(job) {
    if (job.providerConversationId)
        return `${job.instanceId}:${job.providerConversationId}`;
    return `instance:${job.instanceId}`;
}
//# sourceMappingURL=ordering-lock.js.map