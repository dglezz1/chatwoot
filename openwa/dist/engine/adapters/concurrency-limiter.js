"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyLimiter = void 0;
class ConcurrencyLimiter {
    max;
    active = 0;
    waiters = [];
    constructor(max) {
        this.max = max;
        this.max = Math.max(1, Math.floor(max));
    }
    async run(task) {
        if (this.active < this.max) {
            this.active++;
        }
        else {
            await new Promise(resolve => this.waiters.push(resolve));
        }
        try {
            return await task();
        }
        finally {
            const next = this.waiters.shift();
            if (next) {
                next();
            }
            else {
                this.active--;
            }
        }
    }
}
exports.ConcurrencyLimiter = ConcurrencyLimiter;
//# sourceMappingURL=concurrency-limiter.js.map