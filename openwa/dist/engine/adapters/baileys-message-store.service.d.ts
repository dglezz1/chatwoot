import { Repository } from 'typeorm';
import type { WAMessage } from '@whiskeysockets/baileys';
import { BaileysStoredMessage } from './baileys-stored-message.entity';
import { BaileysMessageStore } from '../types/baileys.types';
export declare class BaileysMessageStoreService implements BaileysMessageStore {
    private readonly repo;
    private readonly logger;
    private readonly orphanWarnedSessions;
    private baileysLib?;
    private loadLib;
    constructor(repo: Repository<BaileysStoredMessage>);
    put(sessionId: string, msg: WAMessage): Promise<void>;
    getMessage(sessionId: string, messageId: string): Promise<WAMessage | null>;
    clearSession(sessionId: string): Promise<void>;
    private enforceLimit;
}
