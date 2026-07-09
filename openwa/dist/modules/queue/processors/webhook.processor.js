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
exports.WebhookProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const typeorm_2 = require("typeorm");
const logger_service_1 = require("../../../common/services/logger.service");
const queue_names_1 = require("../queue-names");
const redis_connection_1 = require("../redis-connection");
const webhook_entity_1 = require("../../webhook/entities/webhook.entity");
const webhook_delivery_failure_entity_1 = require("../../webhook/entities/webhook-delivery-failure.entity");
const record_delivery_failure_1 = require("../../webhook/utils/record-delivery-failure");
const hooks_1 = require("../../../core/hooks");
const ssrf_guard_1 = require("../../../common/security/ssrf-guard");
const webhook_delivery_metrics_1 = require("../../../common/metrics/webhook-delivery-metrics");
let WebhookProcessor = class WebhookProcessor extends bullmq_1.WorkerHost {
    webhookRepository;
    failureRepository;
    hookManager;
    configService;
    logger = (0, logger_service_1.createLogger)('WebhookProcessor');
    constructor(webhookRepository, failureRepository, hookManager, configService) {
        super();
        this.webhookRepository = webhookRepository;
        this.failureRepository = failureRepository;
        this.hookManager = hookManager;
        this.configService = configService;
    }
    async process(job) {
        const { webhookId, url, event, payload, headers, maxRetries } = job.data;
        const startTime = Date.now();
        const sessionId = payload.sessionId;
        this.logger.log(`Processing webhook job ${job.id}`, {
            webhookId,
            event,
            deliveryId: payload.deliveryId,
            idempotencyKey: payload.idempotencyKey,
            attempt: job.attemptsMade + 1,
            action: 'webhook_process_start',
        });
        const requestHeaders = {
            ...headers,
            'X-OpenWA-Retry-Count': String(job.attemptsMade),
        };
        try {
            const { status, statusText, ok } = await (0, ssrf_guard_1.withSafeFetch)(url, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this.configService.get('webhook.timeout', 10000)),
            }, response => ({ status: response.status, statusText: response.statusText, ok: response.ok }), { guard: (0, ssrf_guard_1.isSsrfProtectionEnabled)() });
            const responseTime = Date.now() - startTime;
            if (!ok) {
                throw new Error(`HTTP ${status}: ${statusText}`);
            }
            await this.webhookRepository.update(webhookId, {
                lastTriggeredAt: new Date(),
            });
            await this.hookManager.execute('webhook:delivered', {
                sessionId,
                event,
                webhookId,
                deliveryId: payload.deliveryId,
                statusCode: status,
                responseTime,
                attempt: job.attemptsMade + 1,
            }, { sessionId, source: 'WebhookProcessor' });
            this.logger.log(`Webhook delivered successfully`, {
                webhookId,
                event,
                deliveryId: payload.deliveryId,
                idempotencyKey: payload.idempotencyKey,
                statusCode: status,
                responseTime,
                attempt: job.attemptsMade + 1,
                action: 'webhook_delivered',
            });
            return {
                statusCode: status,
                success: true,
                responseTime,
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isFinalAttempt = job.attemptsMade + 1 >= maxRetries;
            this.logger.error(`Webhook delivery failed`, errorMessage, {
                webhookId,
                event,
                deliveryId: payload.deliveryId,
                idempotencyKey: payload.idempotencyKey,
                responseTime,
                attempt: job.attemptsMade + 1,
                maxRetries,
                isFinalAttempt,
                action: 'webhook_failed',
            });
            if (isFinalAttempt) {
                await this.hookManager.execute('webhook:error', {
                    sessionId,
                    event,
                    webhookId,
                    deliveryId: payload.deliveryId,
                    error: errorMessage,
                    attempt: job.attemptsMade + 1,
                }, { sessionId, source: 'WebhookProcessor' });
                await (0, record_delivery_failure_1.recordWebhookDeliveryFailure)(this.failureRepository, this.logger, {
                    webhookId,
                    sessionId,
                    event,
                    url,
                    idempotencyKey: payload.idempotencyKey,
                    deliveryId: payload.deliveryId,
                    attempts: job.attemptsMade + 1,
                    lastStatusCode: (0, record_delivery_failure_1.statusCodeFromError)(errorMessage),
                    lastError: errorMessage,
                });
                (0, webhook_delivery_metrics_1.incrementWebhookDeliveryFailures)();
            }
            throw error;
        }
    }
};
exports.WebhookProcessor = WebhookProcessor;
exports.WebhookProcessor = WebhookProcessor = __decorate([
    (0, bullmq_1.Processor)(queue_names_1.QUEUE_NAMES.WEBHOOK, { connection: (0, redis_connection_1.workerConnectionOptions)(), concurrency: (0, redis_connection_1.webhookWorkerConcurrency)() }),
    __param(0, (0, typeorm_1.InjectRepository)(webhook_entity_1.Webhook, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(webhook_delivery_failure_entity_1.WebhookDeliveryFailure, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        hooks_1.HookManager,
        config_1.ConfigService])
], WebhookProcessor);
//# sourceMappingURL=webhook.processor.js.map