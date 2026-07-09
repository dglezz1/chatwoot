import { Repository } from 'typeorm';
import { ConversationMapping, HandoverState } from './entities/conversation-mapping.entity';
export interface MappingKey {
    sessionId: string;
    chatId: string;
    pluginId: string;
    instanceId: string;
}
export declare class ConversationMappingConflict extends Error {
    readonly key: MappingKey;
    readonly providerConversationId: string;
    constructor(key: MappingKey, providerConversationId: string);
}
export declare class ConversationMappingService {
    private readonly repo;
    constructor(repo: Repository<ConversationMapping>);
    upsert(key: MappingKey, providerConversationId: string, patch?: Partial<ConversationMapping>): Promise<void>;
    private updateById;
    get(key: MappingKey): Promise<ConversationMapping | null>;
    findHandoverForChat(sessionId: string, chatId: string): Promise<{
        pluginId: string;
        handoverState: HandoverState;
    } | null>;
    getByProvider(pluginId: string, instanceId: string, providerConversationId: string): Promise<ConversationMapping | null>;
    setHandover(id: string, state: HandoverState): Promise<void>;
}
