"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShutdownService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("./logger.service");
const DEFAULT_SHUTDOWN_DELAY_MS = 3000;
const MAX_SHUTDOWN_DELAY_MS = 30_000;
let ShutdownService = class ShutdownService {
    logger = (0, logger_service_1.createLogger)('ShutdownService');
    destroyCallback = null;
    shuttingDown = false;
    shutdownScheduled = false;
    setShutdownCallback(callback) {
        this.destroyCallback = callback;
    }
    isShuttingDown() {
        return this.shuttingDown;
    }
    markShuttingDown() {
        if (!this.shuttingDown) {
            this.shuttingDown = true;
            this.logger.log('Entering draining state — readiness now reports 503');
        }
    }
    shutdown(delayMs) {
        this.markShuttingDown();
        if (this.shutdownScheduled)
            return;
        this.shutdownScheduled = true;
        const delay = Math.min(delayMs ?? this.resolveDelay(), MAX_SHUTDOWN_DELAY_MS);
        this.logger.log('Graceful shutdown requested', { delayMs: delay });
        setTimeout(() => {
            this.logger.log('Initiating shutdown...');
            const doShutdown = async () => {
                try {
                    if (this.destroyCallback) {
                        await this.destroyCallback();
                    }
                }
                catch (error) {
                    this.logger.error('Error during shutdown', error instanceof Error ? error.message : String(error));
                }
                finally {
                    process.exit(0);
                }
            };
            void doShutdown();
        }, delay);
    }
    resolveDelay() {
        const parsed = Number.parseInt(process.env.SHUTDOWN_DELAY_MS ?? '', 10);
        if (Number.isInteger(parsed) && parsed >= 0)
            return parsed;
        const env = process.env.NODE_ENV;
        return env === 'development' || env === 'test' ? 0 : DEFAULT_SHUTDOWN_DELAY_MS;
    }
};
exports.ShutdownService = ShutdownService;
exports.ShutdownService = ShutdownService = __decorate([
    (0, common_1.Injectable)()
], ShutdownService);
//# sourceMappingURL=shutdown.service.js.map