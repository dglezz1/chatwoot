export declare class WebhookDeliveryFailure {
    id: string;
    webhookId: string;
    sessionId: string;
    event: string;
    url: string;
    idempotencyKey: string;
    deliveryId: string;
    attempts: number;
    lastStatusCode: number | null;
    lastError: string;
    createdAt: Date;
}
