import { ConfigService } from '@nestjs/config';
import { StatsService } from '../stats/stats.service';
export declare const METRICS_RENDER_TTL_MS = 5000;
export declare class MetricsService {
    private readonly config;
    private readonly statsService;
    private cachedRender;
    constructor(config: ConfigService, statsService: StatsService);
    private get token();
    assertScrapeAuthorized(authorizationHeader: string | undefined): void;
    private safeEqual;
    render(): Promise<string>;
    private escapeLabel;
}
