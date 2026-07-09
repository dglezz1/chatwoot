"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const crypto = __importStar(require("crypto"));
const webhook_entity_1 = require("./entities/webhook.entity");
const webhook_delivery_failure_entity_1 = require("./entities/webhook-delivery-failure.entity");
const record_delivery_failure_1 = require("./utils/record-delivery-failure");
const logger_service_1 = require("../../common/services/logger.service");
const webhook_delivery_metrics_1 = require("../../common/metrics/webhook-delivery-metrics");
const paginate_1 = require("../../common/utils/paginate");
const queue_names_1 = require("../queue/queue-names");
const idempotency_util_1 = require("./utils/idempotency.util");
const filter_evaluator_1 = require("./filters/filter-evaluator");
const lid_mapping_store_service_1 = require("../../engine/identity/lid-mapping-store.service");
const wa_id_1 = require("../../engine/identity/wa-id");
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const hooks_1 = require("../../core/hooks");
let WebhookService = class WebhookService {
    webhookRepository;
    failureRepository;
    configService;
    hookManager;
    lidMappingStore;
    webhookQueue;
    logger = (0, logger_service_1.createLogger)('WebhookService');
    queueEnabled;
    cleanupTimer;
    constructor(webhookRepository, failureRepository, configService, hookManager, lidMappingStore, webhookQueue) {
        this.webhookRepository = webhookRepository;
        this.failureRepository = failureRepository;
        this.configService = configService;
        this.hookManager = hookManager;
        this.lidMappingStore = lidMappingStore;
        this.webhookQueue = webhookQueue;
        this.queueEnabled = configService.get('queue.enabled', false);
    }
    onModuleInit() {
        const parsed = Number.parseInt(process.env.WEBHOOK_FAILURE_RETENTION_DAYS ?? '', 10);
        const retentionDays = Number.isInteger(parsed) ? Math.max(0, parsed) : 90;
        if (retentionDays <= 0) {
            this.logger.log('Webhook delivery-failure retention disabled (WEBHOOK_FAILURE_RETENTION_DAYS <= 0)');
            return;
        }
        const runPrune = () => {
            this.pruneDeliveryFailures(retentionDays)
                .then(n => {
                if (n > 0)
                    this.logger.log(`Pruned ${n} webhook delivery-failure(s) older than ${retentionDays} day(s)`);
            })
                .catch(err => this.logger.error('Webhook delivery-failure cleanup failed', err instanceof Error ? err.stack : String(err)));
        };
        runPrune();
        this.cleanupTimer = setInterval(runPrune, 24 * 60 * 60 * 1000);
        this.cleanupTimer.unref?.();
    }
    onModuleDestroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
    async pruneDeliveryFailures(olderThanDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        const result = await this.failureRepository.delete({ createdAt: (0, typeorm_2.LessThan)(cutoff) });
        return result.affected || 0;
    }
    async validateWebhookUrl(url) {
        if (!(0, ssrf_guard_1.isSsrfProtectionEnabled)())
            return;
        try {
            await (0, ssrf_guard_1.assertSafeFetchUrl)(url);
        }
        catch (error) {
            if (error instanceof ssrf_guard_1.SsrfBlockedError) {
                this.logger.warn(`Webhook URL rejected by SSRF guard: ${error.message}`);
                throw new common_1.BadRequestException(ssrf_guard_1.SSRF_BLOCKED_CLIENT_MESSAGE);
            }
            throw error;
        }
    }
    async create(sessionId, dto) {
        await this.validateWebhookUrl(dto.url);
        const webhook = this.webhookRepository.create({
            sessionId,
            url: dto.url,
            events: dto.events || ['message.received'],
            secret: dto.secret || null,
            headers: dto.headers || {},
            filters: dto.filters ?? null,
            retryCount: dto.retryCount ?? 3,
        });
        return this.webhookRepository.save(webhook);
    }
    async findBySession(sessionId) {
        return this.webhookRepository.find({
            where: { sessionId },
            order: { createdAt: 'DESC' },
        });
    }
    async findAll(allowedSessions, opts = {}) {
        const { limit, offset } = (0, paginate_1.resolveListWindow)(opts.limit, opts.offset);
        const options = { order: { createdAt: 'DESC' }, take: limit, skip: offset };
        if (allowedSessions && allowedSessions.length > 0) {
            options.where = { sessionId: (0, typeorm_2.In)(allowedSessions) };
        }
        return this.webhookRepository.find(options);
    }
    async listDeliveryFailures(opts = {}) {
        const { limit, offset } = (0, paginate_1.resolveListWindow)(opts.limit, opts.offset);
        return this.failureRepository.find({
            where: opts.sessionId ? { sessionId: opts.sessionId } : {},
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
    }
    async findOne(sessionId, id) {
        const webhook = await this.webhookRepository.findOne({ where: { id, sessionId } });
        if (!webhook) {
            throw new common_1.NotFoundException(`Webhook with id '${id}' not found`);
        }
        return webhook;
    }
    async update(sessionId, id, dto) {
        const webhook = await this.findOne(sessionId, id);
        if (dto.url !== undefined) {
            await this.validateWebhookUrl(dto.url);
            webhook.url = dto.url;
        }
        if (dto.events !== undefined)
            webhook.events = dto.events;
        if (dto.secret !== undefined)
            webhook.secret = dto.secret || null;
        if (dto.headers !== undefined)
            webhook.headers = dto.headers;
        if (dto.filters !== undefined)
            webhook.filters = dto.filters;
        if (dto.active !== undefined)
            webhook.active = dto.active;
        if (dto.retryCount !== undefined)
            webhook.retryCount = dto.retryCount;
        return this.webhookRepository.save(webhook);
    }
    async delete(sessionId, id) {
        const webhook = await this.findOne(sessionId, id);
        await this.webhookRepository.remove(webhook);
    }
    async test(sessionId, webhookId) {
        const webhook = await this.findOne(sessionId, webhookId);
        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            sessionId,
            idempotencyKey: (0, idempotency_util_1.generateIdempotencyKey)('test', { webhookId: webhook.id }),
            deliveryId: (0, idempotency_util_1.generateDeliveryId)(),
            data: {
                message: 'This is a test webhook from OpenWA',
                webhookId: webhook.id,
                url: webhook.url,
            },
        };
        const body = JSON.stringify(testPayload);
        const headers = {
            ...this.sanitizeCustomHeaders(webhook.headers),
            'Content-Type': 'application/json',
            'User-Agent': 'OpenWA-Webhook/1.0.0',
            'X-OpenWA-Event': 'test',
            'X-OpenWA-Idempotency-Key': testPayload.idempotencyKey,
            'X-OpenWA-Delivery-Id': testPayload.deliveryId,
            'X-OpenWA-Retry-Count': '0',
        };
        if (webhook.secret) {
            headers['X-OpenWA-Signature'] = this.generateSignature(body, webhook.secret);
        }
        try {
            return await (0, ssrf_guard_1.withSafeFetch)(webhook.url, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout(this.configService.get('webhook.timeout', 10000)),
            }, response => ({ success: response.ok, statusCode: response.status }), { guard: (0, ssrf_guard_1.isSsrfProtectionEnabled)() });
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async dispatch(sessionId, event, data) {
        let webhooks;
        try {
            webhooks = await this.webhookRepository.find({
                where: { sessionId, active: true },
            });
        }
        catch (error) {
            this.logger.error(`Webhook dispatch lookup failed for ${event}`, String(error), {
                sessionId,
                action: 'webhook_dispatch_lookup_failed',
            });
            return;
        }
        const resolveLid = (jid) => this.lidMappingStore?.getCached((0, wa_id_1.userPart)(jid)) ?? null;
        const matchingWebhooks = webhooks.filter(w => (w.events.includes(event) || w.events.includes('*')) && (0, filter_evaluator_1.evaluateFilters)(w.filters, event, data, resolveLid));
        const occurredAt = new Date().toISOString();
        const baseIdempotencyKey = (0, idempotency_util_1.generateIdempotencyKey)(event, { ...data, sessionId }, occurredAt);
        const tasks = matchingWebhooks.map(async (webhook) => {
            const deliveryId = (0, idempotency_util_1.generateDeliveryId)();
            const idempotencyKey = `${baseIdempotencyKey}_${webhook.id}`;
            const payload = {
                event,
                timestamp: new Date().toISOString(),
                sessionId,
                idempotencyKey,
                deliveryId,
                data: structuredClone(data),
            };
            const { continue: shouldContinue, data: hookResult } = await this.hookManager.execute('webhook:before', { sessionId, event, payload }, { sessionId, source: 'WebhookService' });
            if (!shouldContinue) {
                this.logger.debug(`Webhook dispatch cancelled by plugin for ${event}`, {
                    webhookId: webhook.id,
                    action: 'webhook_cancelled_by_plugin',
                });
                return;
            }
            const finalPayload = hookResult.payload ?? payload;
            finalPayload.idempotencyKey = idempotencyKey;
            finalPayload.deliveryId = deliveryId;
            const headers = {
                ...this.sanitizeCustomHeaders(webhook.headers),
                'Content-Type': 'application/json',
                'User-Agent': 'OpenWA-Webhook/1.0.0',
                'X-OpenWA-Event': event,
                'X-OpenWA-Idempotency-Key': idempotencyKey,
                'X-OpenWA-Delivery-Id': deliveryId,
                'X-OpenWA-Retry-Count': '0',
            };
            if (this.queueEnabled && this.webhookQueue) {
                try {
                    const signature = webhook.secret ? this.generateSignature(JSON.stringify(finalPayload), webhook.secret) : '';
                    if (webhook.secret) {
                        headers['X-OpenWA-Signature'] = signature;
                    }
                    const jobData = {
                        webhookId: webhook.id,
                        url: webhook.url,
                        event,
                        payload: finalPayload,
                        headers,
                        attempt: 1,
                        maxRetries: webhook.retryCount,
                    };
                    await this.webhookQueue.add(`webhook-${webhook.id}`, jobData, {
                        attempts: webhook.retryCount,
                        backoff: {
                            type: 'exponential',
                            delay: this.configService.get('webhook.retryDelay', 5000),
                        },
                    });
                    await this.hookManager.execute('webhook:queued', { sessionId, event, webhookId: webhook.id, deliveryId }, { sessionId, source: 'WebhookService' });
                    this.logger.debug(`Webhook job queued for ${webhook.id}`, {
                        webhookId: webhook.id,
                        event,
                        idempotencyKey,
                        deliveryId,
                        action: 'webhook_queued',
                    });
                }
                catch (error) {
                    await this.hookManager.execute('webhook:error', { sessionId, event, webhookId: webhook.id, error: `Queue failed: ${String(error)}` }, { sessionId, source: 'WebhookService' });
                    this.logger.error(`Failed to queue webhook ${webhook.id}`, String(error), {
                        webhookId: webhook.id,
                        action: 'webhook_queue_failed',
                    });
                    try {
                        await this.deliverWebhook(webhook, finalPayload, headers);
                        await this.hookManager.execute('webhook:delivered', { sessionId, event, webhookId: webhook.id, deliveryId, fallback: 'queue_failed' }, { sessionId, source: 'WebhookService' });
                        await this.hookManager.execute('webhook:after', { sessionId, event, webhookId: webhook.id, success: true, fallback: 'queue_failed' }, { sessionId, source: 'WebhookService' });
                    }
                    catch (fallbackError) {
                        await this.hookManager.execute('webhook:error', {
                            sessionId,
                            event,
                            webhookId: webhook.id,
                            error: `Queue fallback delivery failed: ${String(fallbackError)}`,
                        }, { sessionId, source: 'WebhookService' });
                        this.logger.error(`Queue fallback delivery failed for webhook ${webhook.id}`, String(fallbackError), {
                            webhookId: webhook.id,
                            action: 'webhook_queue_fallback_failed',
                        });
                    }
                }
            }
            else {
                try {
                    await this.deliverWebhook(webhook, finalPayload, headers);
                    await this.hookManager.execute('webhook:delivered', { sessionId, event, webhookId: webhook.id, deliveryId }, { sessionId, source: 'WebhookService' });
                    await this.hookManager.execute('webhook:after', { sessionId, event, webhookId: webhook.id, success: true }, { sessionId, source: 'WebhookService' });
                }
                catch (error) {
                    await this.hookManager.execute('webhook:error', { sessionId, event, webhookId: webhook.id, error: String(error) }, { sessionId, source: 'WebhookService' });
                    this.logger.error(`Failed to deliver webhook ${webhook.id}`, String(error), {
                        webhookId: webhook.id,
                        action: 'webhook_delivery_failed',
                    });
                }
            }
        });
        await Promise.allSettled(tasks);
    }
    async deliverWebhook(webhook, payload, headers, attempt = 1) {
        const body = JSON.stringify(payload);
        headers['X-OpenWA-Retry-Count'] = String(attempt - 1);
        if (webhook.secret && !headers['X-OpenWA-Signature']) {
            headers['X-OpenWA-Signature'] = this.generateSignature(body, webhook.secret);
        }
        try {
            const { ok, status, statusText } = await (0, ssrf_guard_1.withSafeFetch)(webhook.url, {
                method: 'POST',
                headers,
                body,
                signal: AbortSignal.timeout(this.configService.get('webhook.timeout', 10000)),
            }, response => ({ ok: response.ok, status: response.status, statusText: response.statusText }), { guard: (0, ssrf_guard_1.isSsrfProtectionEnabled)() });
            if (!ok) {
                throw new Error(`HTTP ${status}: ${statusText}`);
            }
            await this.webhookRepository.update(webhook.id, {
                lastTriggeredAt: new Date(),
            });
            this.logger.debug(`Webhook delivered to ${webhook.id}`, {
                webhookId: webhook.id,
                deliveryId: payload.deliveryId,
                action: 'webhook_delivered',
            });
        }
        catch (error) {
            this.logger.error(`Webhook delivery failed for ${webhook.id}`, String(error), {
                webhookId: webhook.id,
                attempt,
                deliveryId: payload.deliveryId,
                action: 'webhook_delivery_failed',
            });
            if (attempt < webhook.retryCount) {
                const delay = this.configService.get('webhook.retryDelay', 5000);
                await this.delay(delay * attempt);
                return this.deliverWebhook(webhook, payload, headers, attempt + 1);
            }
            const errMessage = error instanceof Error ? error.message : String(error);
            await (0, record_delivery_failure_1.recordWebhookDeliveryFailure)(this.failureRepository, this.logger, {
                webhookId: webhook.id,
                sessionId: payload.sessionId,
                event: payload.event,
                url: webhook.url,
                idempotencyKey: payload.idempotencyKey,
                deliveryId: payload.deliveryId,
                attempts: attempt,
                lastStatusCode: (0, record_delivery_failure_1.statusCodeFromError)(errMessage),
                lastError: errMessage,
            });
            (0, webhook_delivery_metrics_1.incrementWebhookDeliveryFailures)();
            throw error;
        }
    }
    sanitizeCustomHeaders(custom) {
        const safe = {};
        for (const [key, value] of Object.entries(custom ?? {})) {
            if (!/^(content-type|x-openwa-)/i.test(key)) {
                safe[key] = value;
            }
        }
        return safe;
    }
    generateSignature(payload, secret) {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payload);
        return `sha256=${hmac.digest('hex')}`;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.WebhookService = WebhookService;
exports.WebhookService = WebhookService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(webhook_entity_1.Webhook, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(webhook_delivery_failure_entity_1.WebhookDeliveryFailure, 'data')),
    __param(4, (0, common_1.Optional)()),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, bullmq_1.InjectQueue)(queue_names_1.QUEUE_NAMES.WEBHOOK)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        hooks_1.HookManager,
        lid_mapping_store_service_1.LidMappingStoreService,
        bullmq_2.Queue])
], WebhookService);
//# sourceMappingURL=webhook.service.js.map