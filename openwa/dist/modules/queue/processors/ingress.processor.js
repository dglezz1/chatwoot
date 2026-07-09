"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngressProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const queue_names_1 = require("../queue-names");
const redis_connection_1 = require("../redis-connection");
const integration_delivery_failure_entity_1 = require("../../integration/entities/integration-delivery-failure.entity");
const plugin_loader_service_1 = require("../../../core/plugins/plugin-loader.service");
const hooks_1 = require("../../../core/hooks");
const logger_service_1 = require("../../../common/services/logger.service");
const ordering_lock_1 = require("../../integration/ordering-lock");
let IngressProcessor = class IngressProcessor extends bullmq_1.WorkerHost {
    loader;
    failures;
    hooks;
    logger = (0, logger_service_1.createLogger)('IngressProcessor');
    lock = new ordering_lock_1.KeyedAsyncLock();
    constructor(loader, failures, hooks) {
        super();
        this.loader = loader;
        this.failures = failures;
        this.hooks = hooks;
    }
    async process(job) {
        const d = job.data;
        try {
            await this.lock.run((0, ordering_lock_1.orderingKeyFor)(d), () => this.loader.dispatchWebhookForInstance(d));
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
            this.logger.error('Ingress dispatch failed', errorMessage, {
                pluginId: d.pluginId,
                instanceId: d.instanceId,
                route: d.route,
                deliveryId: d.deliveryId,
                attempt: job.attemptsMade + 1,
                isFinalAttempt,
                action: 'ingress_dispatch_failed',
            });
            if (isFinalAttempt) {
                await this.hooks.execute('ingress:error', { ...d, error: errorMessage }, { sessionId: d.sessionId, source: 'IngressProcessor' });
                await this.failures.save({
                    direction: 'inbound',
                    pluginId: d.pluginId,
                    instanceId: d.instanceId,
                    sessionId: d.sessionId ?? null,
                    deliveryId: d.deliveryId,
                    attempts: job.attemptsMade + 1,
                    lastError: errorMessage,
                    payload: { route: d.route, providerConversationId: d.providerConversationId, ingress: d.payload },
                    redriven: false,
                });
            }
            throw err;
        }
    }
};
exports.IngressProcessor = IngressProcessor;
exports.IngressProcessor = IngressProcessor = __decorate([
    (0, bullmq_1.Processor)(queue_names_1.QUEUE_NAMES.INGRESS, { connection: (0, redis_connection_1.workerConnectionOptions)(), concurrency: (0, redis_connection_1.ingressWorkerConcurrency)() }),
    __param(1, (0, typeorm_1.InjectRepository)(integration_delivery_failure_entity_1.IntegrationDeliveryFailure, 'data')),
    __metadata("design:paramtypes", [plugin_loader_service_1.PluginLoaderService,
        typeorm_2.Repository,
        hooks_1.HookManager])
], IngressProcessor);
//# sourceMappingURL=ingress.processor.js.map