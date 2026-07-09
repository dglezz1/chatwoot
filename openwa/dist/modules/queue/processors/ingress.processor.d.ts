import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { IntegrationDeliveryFailure } from '../../integration/entities/integration-delivery-failure.entity';
import { PluginLoaderService } from '../../../core/plugins/plugin-loader.service';
import { HookManager } from '../../../core/hooks';
export interface IngressJobData {
    pluginId: string;
    instanceId: string;
    route: string;
    deliveryId: string;
    sessionId?: string;
    providerConversationId?: string;
    payload: {
        headers: Record<string, string>;
        query: Record<string, string>;
        body: string;
        rawBody: string;
    };
}
export declare class IngressProcessor extends WorkerHost {
    private readonly loader;
    private readonly failures;
    private readonly hooks;
    private readonly logger;
    private readonly lock;
    constructor(loader: PluginLoaderService, failures: Repository<IntegrationDeliveryFailure>, hooks: HookManager);
    process(job: Job<IngressJobData>): Promise<void>;
}
