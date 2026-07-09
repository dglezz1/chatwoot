export declare class IngressEvent {
    id: string;
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
    createdAt: Date;
}
