"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUncaughtExceptionMonitor = registerUncaughtExceptionMonitor;
function registerUncaughtExceptionMonitor(logger) {
    process.on('uncaughtExceptionMonitor', (err, origin) => {
        try {
            logger.error(`Uncaught exception (${origin}) — process will exit`, err instanceof Error ? err.stack : String(err));
        }
        catch {
        }
    });
}
//# sourceMappingURL=process-error-monitor.js.map