import { Webhook } from '../entities/webhook.entity';
import { WebhookFilters } from '../filters/filter-types';
export declare const WEBHOOK_RESERVED_EVENTS: readonly ["group.join", "group.leave", "group.update"];
export declare const WEBHOOK_EVENTS: readonly ["message.received", "message.sent", "message.ack", "message.failed", "message.revoked", "message.reaction", "session.status", "session.qr", "session.authenticated", "session.disconnected", "group.join", "group.leave", "group.update"];
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
export declare class CreateWebhookDto {
    url: string;
    events?: string[];
    secret?: string;
    headers?: Record<string, string>;
    filters?: WebhookFilters | null;
    retryCount?: number;
}
export declare class UpdateWebhookDto {
    url?: string;
    events?: string[];
    secret?: string;
    headers?: Record<string, string>;
    filters?: WebhookFilters | null;
    active?: boolean;
    retryCount?: number;
}
export declare class WebhookResponseDto {
    id: string;
    sessionId: string;
    url: string;
    events: string[];
    filters?: WebhookFilters | null;
    active: boolean;
    retryCount: number;
    lastTriggeredAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    static fromEntity(entity: Webhook): WebhookResponseDto;
    static fromEntities(entities: Webhook[]): WebhookResponseDto[];
}
