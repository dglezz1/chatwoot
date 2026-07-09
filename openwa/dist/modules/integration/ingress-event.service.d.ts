import { Repository } from 'typeorm';
import { IngressEvent } from './entities/ingress-event.entity';
export interface IngressEventInput {
    instanceId: string;
    pluginId: string;
    providerDeliveryId: string;
    route: string;
    payload: {
        headers: Record<string, string>;
        query: Record<string, string>;
        body: string;
        rawBody: string;
    };
    sessionId: string | null;
}
export declare class IngressEventService {
    private readonly repo;
    constructor(repo: Repository<IngressEvent>);
    recordOrSkip(input: IngressEventInput): Promise<boolean>;
}
