import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { WebhookJobData } from '../../webhook/webhook.service';
import { Webhook } from '../../webhook/entities/webhook.entity';
import { WebhookDeliveryFailure } from '../../webhook/entities/webhook-delivery-failure.entity';
import { HookManager } from '../../../core/hooks';
export interface WebhookJobResult {
    statusCode: number;
    success: boolean;
    error?: string;
    responseTime: number;
}
export declare class WebhookProcessor extends WorkerHost {
    private readonly webhookRepository;
    private readonly failureRepository;
    private readonly hookManager;
    private readonly configService;
    private readonly logger;
    constructor(webhookRepository: Repository<Webhook>, failureRepository: Repository<WebhookDeliveryFailure>, hookManager: HookManager, configService: ConfigService);
    process(job: Job<WebhookJobData>): Promise<WebhookJobResult>;
}
