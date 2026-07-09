import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Webhook } from './entities/webhook.entity';
import { WebhookDeliveryFailure } from './entities/webhook-delivery-failure.entity';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { ListOptions } from '../../common/utils/paginate';
import { LidMappingStoreService } from '../../engine/identity/lid-mapping-store.service';
import { HookManager } from '../../core/hooks';
export interface WebhookPayload {
    event: string;
    timestamp: string;
    sessionId: string;
    idempotencyKey: string;
    deliveryId: string;
    data: Record<string, unknown>;
}
export interface WebhookJobData {
    webhookId: string;
    url: string;
    event: string;
    payload: WebhookPayload;
    headers: Record<string, string>;
    attempt: number;
    maxRetries: number;
}
export declare class WebhookService implements OnModuleInit, OnModuleDestroy {
    private readonly webhookRepository;
    private readonly failureRepository;
    private readonly configService;
    private readonly hookManager;
    private readonly lidMappingStore?;
    private readonly webhookQueue?;
    private readonly logger;
    private readonly queueEnabled;
    private cleanupTimer?;
    constructor(webhookRepository: Repository<Webhook>, failureRepository: Repository<WebhookDeliveryFailure>, configService: ConfigService, hookManager: HookManager, lidMappingStore?: LidMappingStoreService | undefined, webhookQueue?: Queue<WebhookJobData> | undefined);
    onModuleInit(): void;
    onModuleDestroy(): void;
    pruneDeliveryFailures(olderThanDays: number): Promise<number>;
    private validateWebhookUrl;
    create(sessionId: string, dto: CreateWebhookDto): Promise<Webhook>;
    findBySession(sessionId: string): Promise<Webhook[]>;
    findAll(allowedSessions?: string[] | null, opts?: ListOptions): Promise<Webhook[]>;
    listDeliveryFailures(opts?: ListOptions & {
        sessionId?: string;
    }): Promise<WebhookDeliveryFailure[]>;
    findOne(sessionId: string, id: string): Promise<Webhook>;
    update(sessionId: string, id: string, dto: UpdateWebhookDto): Promise<Webhook>;
    delete(sessionId: string, id: string): Promise<void>;
    test(sessionId: string, webhookId: string): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
    dispatch(sessionId: string, event: string, data: Record<string, unknown>): Promise<void>;
    private deliverWebhook;
    private sanitizeCustomHeaders;
    private generateSignature;
    private delay;
}
