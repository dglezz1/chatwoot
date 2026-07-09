"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerConnectionOptions = workerConnectionOptions;
exports.webhookWorkerConcurrency = webhookWorkerConcurrency;
exports.ingressWorkerConcurrency = ingressWorkerConcurrency;
function workerConnectionOptions() {
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10),
    };
}
const DEFAULT_WEBHOOK_WORKER_CONCURRENCY = 10;
function webhookWorkerConcurrency() {
    const parsed = parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_WEBHOOK_WORKER_CONCURRENCY;
}
const DEFAULT_INGRESS_WORKER_CONCURRENCY = 10;
function ingressWorkerConcurrency() {
    const parsed = parseInt(process.env.INGRESS_WORKER_CONCURRENCY || '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INGRESS_WORKER_CONCURRENCY;
}
//# sourceMappingURL=redis-connection.js.map