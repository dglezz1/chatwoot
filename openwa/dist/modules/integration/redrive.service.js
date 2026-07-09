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
exports.RedriveService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_delivery_failure_entity_1 = require("./entities/integration-delivery-failure.entity");
const ingress_enqueue_service_1 = require("./ingress-enqueue.service");
let RedriveService = class RedriveService {
    repo;
    ingressEnqueue;
    constructor(repo, ingressEnqueue) {
        this.repo = repo;
        this.ingressEnqueue = ingressEnqueue;
    }
    async redriveInstance(pluginId, instanceId) {
        const rows = await this.repo.find({ where: { pluginId, instanceId, direction: 'inbound', redriven: false } });
        let redriven = 0;
        for (const row of rows) {
            const stored = (row.payload ?? {});
            const jobId = `redrive:${row.id}`;
            const { outcome } = await this.ingressEnqueue.enqueue({
                pluginId,
                instanceId,
                route: stored.route ?? '',
                deliveryId: row.deliveryId ?? row.id,
                sessionId: row.sessionId ?? undefined,
                providerConversationId: stored.providerConversationId,
                payload: stored.ingress,
            }, jobId);
            if (outcome !== 'failed') {
                await this.repo.update({ id: row.id }, { redriven: true });
                redriven++;
            }
        }
        return { redriven };
    }
};
exports.RedriveService = RedriveService;
exports.RedriveService = RedriveService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_delivery_failure_entity_1.IntegrationDeliveryFailure, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        ingress_enqueue_service_1.IngressEnqueueService])
], RedriveService);
//# sourceMappingURL=redrive.service.js.map