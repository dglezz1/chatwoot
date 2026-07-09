import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PluginLoaderService } from '../../core/plugins/plugin-loader.service';
import { IngressJobData } from '../queue/processors/ingress.processor';
import { IntegrationDeliveryFailure } from './entities/integration-delivery-failure.entity';
export type EnqueueOutcome = {
    outcome: 'queued' | 'dispatched' | 'failed';
    error?: string;
};
export declare function resolveIngressJobOptions(): {
    attempts: number;
    backoff: {
        type: 'exponential';
        delay: number;
    };
};
export declare function buildIngressDeadLetterRow(data: IngressJobData, error?: string): Partial<IntegrationDeliveryFailure>;
export declare class IngressEnqueueService {
    private readonly loader;
    private readonly config;
    private readonly ingressQueue?;
    private readonly logger;
    constructor(loader: PluginLoaderService, config: ConfigService, ingressQueue?: Queue<IngressJobData> | undefined);
    enqueue(data: IngressJobData, jobId: string): Promise<EnqueueOutcome>;
}
