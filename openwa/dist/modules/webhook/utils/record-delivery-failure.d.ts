import { Repository } from 'typeorm';
import { WebhookDeliveryFailure } from '../entities/webhook-delivery-failure.entity';
export interface WebhookDeliveryFailureInput {
    webhookId: string;
    sessionId: string;
    event: string;
    url: string;
    idempotencyKey?: string;
    deliveryId?: string;
    attempts: number;
    lastStatusCode?: number | null;
    lastError: string;
}
interface ErrorLogger {
    error(message: string, ...meta: unknown[]): void;
}
export declare function statusCodeFromError(message: string): number | null;
export declare function recordWebhookDeliveryFailure(repo: Repository<WebhookDeliveryFailure>, logger: ErrorLogger, input: WebhookDeliveryFailureInput): Promise<void>;
export {};
