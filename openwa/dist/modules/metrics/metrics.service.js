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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = exports.METRICS_RENDER_TTL_MS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const stats_service_1 = require("../stats/stats.service");
const webhook_delivery_metrics_1 = require("../../common/metrics/webhook-delivery-metrics");
exports.METRICS_RENDER_TTL_MS = 5000;
let MetricsService = class MetricsService {
    config;
    statsService;
    cachedRender = null;
    constructor(config, statsService) {
        this.config = config;
        this.statsService = statsService;
    }
    get token() {
        return (this.config.get('METRICS_TOKEN') ?? '').trim();
    }
    assertScrapeAuthorized(authorizationHeader) {
        const expected = this.token;
        if (!expected) {
            throw new common_1.NotFoundException('Metrics endpoint is disabled (set METRICS_TOKEN to enable)');
        }
        const provided = (authorizationHeader ?? '').replace(/^Bearer\s+/i, '').trim();
        if (!provided || !this.safeEqual(provided, expected)) {
            throw new common_1.UnauthorizedException('Invalid metrics token');
        }
    }
    safeEqual(a, b) {
        const ab = Buffer.from(a);
        const bb = Buffer.from(b);
        if (ab.length !== bb.length)
            return false;
        return (0, crypto_1.timingSafeEqual)(ab, bb);
    }
    async render() {
        const now = Date.now();
        if (this.cachedRender && now - this.cachedRender.at < exports.METRICS_RENDER_TTL_MS) {
            return this.cachedRender.text;
        }
        const overview = await this.statsService.getOverview();
        const mem = process.memoryUsage();
        const lines = [];
        const gauge = (name, help, value, labels = '') => {
            lines.push(`# HELP ${name} ${help}`);
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name}${labels} ${value}`);
        };
        gauge('openwa_up', 'Whether the OpenWA process is up (always 1 when scraped).', 1);
        gauge('openwa_process_uptime_seconds', 'Process uptime in seconds.', Math.round(process.uptime()));
        gauge('openwa_process_resident_memory_bytes', 'Resident set size in bytes.', mem.rss);
        gauge('openwa_process_heap_used_bytes', 'V8 heap used in bytes.', mem.heapUsed);
        gauge('openwa_sessions_total', 'Total number of configured sessions.', overview.sessions.total);
        gauge('openwa_sessions_active', 'Number of READY (active) sessions.', overview.sessions.active);
        lines.push('# HELP openwa_sessions Number of sessions by status.');
        lines.push('# TYPE openwa_sessions gauge');
        for (const [status, count] of Object.entries(overview.sessions.byStatus)) {
            lines.push(`openwa_sessions{status="${this.escapeLabel(status)}"} ${count}`);
        }
        lines.push('# HELP openwa_messages_total Total messages by direction.');
        lines.push('# TYPE openwa_messages_total counter');
        lines.push(`openwa_messages_total{direction="outgoing"} ${overview.messages.sent}`);
        lines.push(`openwa_messages_total{direction="incoming"} ${overview.messages.received}`);
        lines.push('# HELP openwa_messages_failed_total Total messages in FAILED state.');
        lines.push('# TYPE openwa_messages_failed_total counter');
        lines.push(`openwa_messages_failed_total ${overview.messages.failed}`);
        lines.push('# HELP openwa_webhook_delivery_failures_total Webhook deliveries that terminally failed (all retries exhausted) since process start.');
        lines.push('# TYPE openwa_webhook_delivery_failures_total counter');
        lines.push(`openwa_webhook_delivery_failures_total ${(0, webhook_delivery_metrics_1.getWebhookDeliveryFailuresTotal)()}`);
        const text = lines.join('\n') + '\n';
        this.cachedRender = { at: now, text };
        return text;
    }
    escapeLabel(value) {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        stats_service_1.StatsService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map