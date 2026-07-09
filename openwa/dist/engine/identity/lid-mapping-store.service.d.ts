import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LidMapping } from './lid-mapping.entity';
export interface LidMappingStore {
    getCached(lid: string): string | null | undefined;
    lidsForPhone(phone: string): string[];
    remember(lid: string, phone: string | null, sessionId?: string): Promise<void>;
}
export declare class LidMappingStoreService implements LidMappingStore, OnModuleInit {
    private readonly repo;
    private readonly logger;
    private readonly lidToPhone;
    private readonly phoneToLids;
    constructor(repo: Repository<LidMapping>);
    onModuleInit(): Promise<void>;
    getCached(lid: string): string | null | undefined;
    lidsForPhone(phone: string): string[];
    remember(lid: string, phone: string | null, sessionId?: string): Promise<void>;
    private index;
}
