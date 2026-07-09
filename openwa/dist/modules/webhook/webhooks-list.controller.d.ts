import { WebhookService } from './webhook.service';
import { WebhookResponseDto } from './dto';
import { WebhookDeliveryFailure } from './entities/webhook-delivery-failure.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
export declare class WebhooksListController {
    private readonly webhookService;
    constructor(webhookService: WebhookService);
    deliveryFailures(sessionId?: string, limit?: string, offset?: string): Promise<WebhookDeliveryFailure[]>;
    findAll(apiKey?: ApiKey, limit?: string, offset?: string): Promise<WebhookResponseDto[]>;
}
