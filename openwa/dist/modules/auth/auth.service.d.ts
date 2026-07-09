import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
export declare function resolveSeedApiKey(): string;
export declare function bannerKeyLine(displayKey: string, isNewKey: boolean): string;
export declare class AuthService implements OnModuleInit {
    private readonly apiKeyRepository;
    private readonly logger;
    private static readonly STAT_FLUSH_INTERVAL_MS;
    private readonly pendingUsage;
    constructor(apiKeyRepository: Repository<ApiKey>);
    onModuleInit(): Promise<void>;
    private seedApiKey;
    createApiKey(dto: CreateApiKeyDto): Promise<{
        apiKey: ApiKey;
        rawKey: string;
    }>;
    findAll(): Promise<ApiKey[]>;
    findOne(id: string): Promise<ApiKey>;
    update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey>;
    delete(id: string): Promise<void>;
    revoke(id: string): Promise<ApiKey>;
    validateApiKey(rawKey: string, clientIp?: string, sessionId?: string): Promise<ApiKey>;
    private hashKey;
    private isIpAllowed;
    hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean;
}
