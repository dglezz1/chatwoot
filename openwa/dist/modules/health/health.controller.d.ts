import { DataSource } from 'typeorm';
import { ShutdownService } from '../../common/services/shutdown.service';
interface DependencyStatus {
    status: 'up' | 'down';
}
interface HealthCheckResult {
    status: 'ok' | 'error';
    details: Record<string, DependencyStatus>;
}
export declare class HealthController {
    private readonly mainDataSource;
    private readonly dataDataSource;
    private readonly shutdownService;
    constructor(mainDataSource: DataSource, dataDataSource: DataSource, shutdownService: ShutdownService);
    check(): {
        status: string;
        timestamp: string;
        version: string;
    };
    liveness(): {
        status: string;
    };
    readiness(): Promise<HealthCheckResult>;
    private probeDatabase;
    private withTimeout;
}
export {};
