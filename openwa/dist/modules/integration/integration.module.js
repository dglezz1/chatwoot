"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const plugin_instance_entity_1 = require("./entities/plugin-instance.entity");
const ingress_event_entity_1 = require("./entities/ingress-event.entity");
const integration_delivery_failure_entity_1 = require("./entities/integration-delivery-failure.entity");
const plugin_instance_service_1 = require("./plugin-instance.service");
const ingress_event_service_1 = require("./ingress-event.service");
const ingress_service_1 = require("./ingress.service");
const ingress_controller_1 = require("./ingress.controller");
const ingress_enqueue_service_1 = require("./ingress-enqueue.service");
const redrive_service_1 = require("./redrive.service");
const redrive_controller_1 = require("./redrive.controller");
const integration_instance_controller_1 = require("./integration-instance.controller");
const scope_binding_service_1 = require("./scope-binding.service");
const plugin_loader_service_1 = require("../../core/plugins/plugin-loader.service");
const logger_service_1 = require("../../common/services/logger.service");
let IntegrationModule = class IntegrationModule {
};
exports.IntegrationModule = IntegrationModule;
exports.IntegrationModule = IntegrationModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([plugin_instance_entity_1.PluginInstance, ingress_event_entity_1.IngressEvent, integration_delivery_failure_entity_1.IntegrationDeliveryFailure], 'data')],
        controllers: [ingress_controller_1.IngressController, redrive_controller_1.RedriveController, integration_instance_controller_1.IntegrationInstanceController],
        providers: [
            plugin_instance_service_1.PluginInstanceService,
            ingress_event_service_1.IngressEventService,
            ingress_enqueue_service_1.IngressEnqueueService,
            redrive_service_1.RedriveService,
            scope_binding_service_1.ScopeBindingService,
            {
                provide: ingress_service_1.IngressService,
                inject: [
                    plugin_instance_service_1.PluginInstanceService,
                    ingress_event_service_1.IngressEventService,
                    plugin_loader_service_1.PluginLoaderService,
                    ingress_enqueue_service_1.IngressEnqueueService,
                    (0, typeorm_1.getRepositoryToken)(integration_delivery_failure_entity_1.IntegrationDeliveryFailure, 'data'),
                ],
                useFactory: (instances, events, loader, ingressEnqueue, failures) => {
                    const dlqLogger = (0, logger_service_1.createLogger)('IngressEnqueue');
                    return new ingress_service_1.IngressService({
                        instances: { resolve: (pluginId, instanceId) => instances.resolve(pluginId, instanceId) },
                        manifestRoute: (pluginId, route) => loader.getPlugin(pluginId)?.manifest.ingress?.find(r => r.route === route),
                        events: { recordOrSkip: input => events.recordOrSkip(input) },
                        enqueue: async (data, jobId) => {
                            const result = await ingressEnqueue.enqueue(data, jobId);
                            if (result.outcome === 'failed') {
                                try {
                                    await failures.save((0, ingress_enqueue_service_1.buildIngressDeadLetterRow)(data, result.error));
                                }
                                catch (err) {
                                    dlqLogger.error('Failed to persist ingress dead-letter row after inline dispatch failure', err instanceof Error ? err.message : String(err), { pluginId: data.pluginId, instanceId: data.instanceId, deliveryId: data.deliveryId });
                                }
                            }
                            return result;
                        },
                        now: () => Date.now(),
                    });
                },
            },
        ],
        exports: [plugin_instance_service_1.PluginInstanceService, ingress_event_service_1.IngressEventService],
    })
], IntegrationModule);
//# sourceMappingURL=integration.module.js.map