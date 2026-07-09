import { Repository } from 'typeorm';
import { IntegrationDeliveryFailure } from './entities/integration-delivery-failure.entity';
import { IngressEnqueueService } from './ingress-enqueue.service';
export declare class RedriveService {
    private readonly repo;
    private readonly ingressEnqueue;
    constructor(repo: Repository<IntegrationDeliveryFailure>, ingressEnqueue: IngressEnqueueService);
    redriveInstance(pluginId: string, instanceId: string): Promise<{
        redriven: number;
    }>;
}
