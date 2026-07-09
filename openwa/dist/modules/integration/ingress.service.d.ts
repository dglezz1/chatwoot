import { PluginIngressRoute } from '../../core/plugins/plugin.interfaces';
import { IngressJobData } from '../queue/processors/ingress.processor';
export interface IngressRequest {
    pluginId: string;
    instanceId: string;
    route: string;
    method: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    rawBody: string;
}
export interface ResolvedInstance {
    id: string;
    pluginId: string;
    instanceId: string;
    secret: string;
    enabled: boolean;
    sessionScope: string | null;
    verifyToken: string | null;
}
export type IngressRouteDescriptor = PluginIngressRoute & {
    dedupHeader?: string;
};
export interface IngressDeps {
    instances: {
        resolve(pluginId: string, instanceId: string): Promise<ResolvedInstance | null>;
    };
    manifestRoute: (pluginId: string, route: string) => IngressRouteDescriptor | undefined;
    events: {
        recordOrSkip(input: {
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
        }): Promise<boolean>;
    };
    enqueue: (data: IngressJobData, jobId: string) => Promise<unknown>;
    now: () => number;
}
export declare class IngressService {
    private readonly deps;
    constructor(deps: IngressDeps);
    handle(req: IngressRequest): Promise<{
        status: number;
        body?: string;
    }>;
}
export declare function extractConversationId(spec: {
    header?: string;
    jsonPointer?: string;
} | undefined, headers: Record<string, string>, rawBody: string): string | undefined;
