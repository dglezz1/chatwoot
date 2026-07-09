import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EngineFactory } from '../../engine/engine.factory';
import { DockerService } from '../docker';
import { CacheService } from '../../common/cache/cache.service';
import { StorageService } from '../../common/storage/storage.service';
import { ShutdownService } from '../../common/services/shutdown.service';
import { ImportStorageDto } from './dto/import-storage.dto';
interface InfraStatus {
    database: {
        connected: boolean;
        type: string;
        host: string;
        builtIn: boolean;
    };
    redis: {
        enabled: boolean;
        connected: boolean;
        host: string;
        port: number;
        builtIn: boolean;
    };
    queue: {
        enabled: boolean;
        webhooks: {
            pending: number;
            completed: number;
            failed: number;
        };
    };
    storage: {
        type: 'local' | 's3';
        path?: string;
        bucket?: string;
        builtIn: boolean;
        s3Available?: boolean;
    };
    engine: {
        type: string;
        headless: boolean;
        sessionDataPath: string;
        browserArgs: string;
        webVersion?: string | null;
        webVersionSource?: 'pinned' | 'auto' | 'native';
    };
}
interface SaveConfigDto {
    database?: {
        type: 'sqlite' | 'postgres';
        builtIn?: boolean;
        host?: string;
        port?: string;
        username?: string;
        password?: string;
        database?: string;
        schema?: string;
        poolSize?: number;
        sslEnabled?: boolean;
        sslRejectUnauthorized?: boolean;
    };
    redis?: {
        enabled?: boolean;
        builtIn?: boolean;
        host?: string;
        port?: string;
        password?: string;
    };
    queue?: {
        enabled?: boolean;
    };
    storage?: {
        type: 'local' | 's3';
        builtIn?: boolean;
        localPath?: string;
        s3Bucket?: string;
        s3Region?: string;
        s3AccessKey?: string;
        s3SecretKey?: string;
        s3Endpoint?: string;
    };
    engine?: {
        type?: string;
        headless?: boolean;
        sessionDataPath?: string;
        browserArgs?: string;
    };
}
interface SessionRow {
    id: string;
    name: string;
    status: string;
    phone: string | null;
    pushName: string | null;
    config: string | Record<string, unknown>;
    proxyUrl: string | null;
    proxyType: string | null;
    connectedAt: string | null;
    lastActiveAt: string | null;
    createdAt: string;
    updatedAt: string;
}
interface WebhookRow {
    id: string;
    sessionId: string;
    url: string;
    events: string | string[];
    secret: string | null;
    headers: string | Record<string, string>;
    filters: string | Record<string, unknown> | null;
    active: boolean | number;
    retryCount: number;
    lastTriggeredAt: string | null;
    createdAt: string;
    updatedAt: string;
}
interface MessageRow {
    id: string;
    sessionId: string;
    waMessageId: string | null;
    chatId: string;
    from: string;
    to: string;
    body: string | null;
    type: string;
    direction: string;
    timestamp: number | string | null;
    metadata: string | Record<string, unknown> | null;
    status: string;
    createdAt: string;
}
interface MessageBatchRow {
    id: string;
    batch_id: string;
    session_id: string;
    status: string;
    messages: string | unknown[];
    options: string | Record<string, unknown> | null;
    progress: string | Record<string, unknown> | null;
    results: string | unknown[] | null;
    current_index: number;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
}
interface TemplateRow {
    id: string;
    sessionId: string;
    name: string;
    body: string;
    header: string | null;
    footer: string | null;
    createdAt: string;
    updatedAt: string;
}
interface BaileysStoredMessageRow {
    id: string;
    sessionId: string;
    waMessageId: string;
    serializedMessage: string;
    createdAt: string;
}
interface LidMappingRow {
    lid: string;
    phone: string | null;
    sessionId: string | null;
    updatedAt: string;
}
interface MigrationTables {
    sessions: SessionRow[];
    webhooks: WebhookRow[];
    messages: MessageRow[];
    messageBatches: MessageBatchRow[];
    templates: TemplateRow[];
    baileysStoredMessages: BaileysStoredMessageRow[];
    lidMappings: LidMappingRow[];
}
interface SavedConfigResponse {
    database: {
        type: 'sqlite' | 'postgres';
        builtIn: boolean;
        host: string;
        port: string;
        username: string;
        database: string;
        schema: string;
        poolSize: number;
        sslEnabled: boolean;
        sslRejectUnauthorized: boolean;
        passwordSet: boolean;
    };
    redis: {
        enabled: boolean;
        builtIn: boolean;
        host: string;
        port: string;
        passwordSet: boolean;
    };
    queue: {
        enabled: boolean;
    };
    storage: {
        type: 'local' | 's3';
        builtIn: boolean;
        localPath: string;
        s3Bucket: string;
        s3Region: string;
        s3Endpoint: string;
        s3CredentialsSet: boolean;
    };
    engine: {
        type: string;
        headless: boolean;
        sessionDataPath: string;
        browserArgs: string;
    };
}
export declare class InfraController {
    private readonly configService;
    private readonly mainDataSource;
    private readonly dataDataSource;
    private readonly engineFactory;
    private readonly dockerService;
    private readonly cacheService;
    private readonly storageService;
    private readonly shutdownService;
    private readonly webhookQueue?;
    private readonly logger;
    constructor(configService: ConfigService, mainDataSource: DataSource, dataDataSource: DataSource, engineFactory: EngineFactory, dockerService: DockerService, cacheService: CacheService, storageService: StorageService, shutdownService: ShutdownService, webhookQueue?: Queue | undefined);
    private static readonly DB_PROBE_TIMEOUT_MS;
    private probeDbConnected;
    getStatus(): Promise<InfraStatus>;
    private readSavedBuiltinFlags;
    getEngines(): Array<{
        id: string;
        name: string;
        enabled: boolean;
        features: string[];
    }>;
    getCurrentEngine(): {
        engineType: string;
    };
    getConfig(): SavedConfigResponse;
    saveConfig(config: SaveConfigDto): {
        message: string;
        saved: boolean;
        envPath: string;
        profiles: string[];
    };
    requestRestart(body?: {
        profiles?: string[];
        profilesToRemove?: string[];
    }): Promise<{
        message: string;
        restarting: boolean;
        profiles: string[];
        profilesToRemove: string[];
        estimatedTime: number;
        orchestration?: object;
        removal?: object;
    }>;
    healthCheck(): {
        status: string;
        timestamp: string;
    };
    exportData(): Promise<{
        exportedAt: string;
        dataDbType: string;
        tables: MigrationTables;
        counts: {
            sessions: number;
            webhooks: number;
            messages: number;
            messageBatches: number;
            templates: number;
            baileysStoredMessages: number;
            lidMappings: number;
        };
    }>;
    importData(data: {
        tables: Partial<MigrationTables>;
    }): Promise<{
        imported: boolean;
        counts: {
            sessions: number;
            webhooks: number;
            messages: number;
            messageBatches: number;
            templates: number;
            baileysStoredMessages: number;
            lidMappings: number;
        };
        warnings: string[];
    }>;
    getStorageFileCount(): Promise<{
        storageType: string;
        count: number;
        sizeBytes: number;
        sizeMB: string;
    }>;
    exportStorage(): Promise<{
        message: string;
        download: string;
    }>;
    importStorage(body: ImportStorageDto): Promise<{
        imported: boolean;
        count: number;
        storageType: string;
    }>;
}
export {};
