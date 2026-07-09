import { SessionService } from './session.service';
import { CreateSessionDto, SessionResponseDto, QRCodeResponseDto, MarkChatReadDto, DeleteChatDto, SendChatStateDto, RequestPairingCodeDto, PairingCodeResponseDto } from './dto';
import { Session } from './entities/session.entity';
import { ChatSummary } from '../../engine/interfaces/whatsapp-engine.interface';
import { AuditService } from '../audit/audit.service';
import { ApiKey } from '../auth/entities/api-key.entity';
export declare class SessionController {
    private readonly sessionService;
    private readonly auditService;
    constructor(sessionService: SessionService, auditService: AuditService);
    private transformSession;
    create(dto: CreateSessionDto): Promise<Session>;
    findAll(apiKey?: ApiKey, limit?: string, offset?: string): Promise<SessionResponseDto[]>;
    findOne(id: string): Promise<SessionResponseDto>;
    delete(id: string): Promise<void>;
    start(id: string): Promise<SessionResponseDto>;
    stop(id: string): Promise<SessionResponseDto>;
    forceKill(id: string): Promise<SessionResponseDto>;
    getQRCode(id: string): Promise<QRCodeResponseDto>;
    requestPairingCode(id: string, dto: RequestPairingCodeDto): Promise<PairingCodeResponseDto>;
    getGroups(id: string, limit?: string, offset?: string): Promise<{
        id: string;
        name: string;
        linkedParentJID?: string | null;
    }[]>;
    getChats(id: string, limit?: string, offset?: string): Promise<ChatSummary[]>;
    markChatRead(id: string, dto: MarkChatReadDto): Promise<{
        success: boolean;
    }>;
    markChatUnread(id: string, dto: MarkChatReadDto): Promise<{
        success: boolean;
    }>;
    deleteChat(id: string, dto: DeleteChatDto): Promise<{
        success: boolean;
    }>;
    sendChatState(id: string, dto: SendChatStateDto): Promise<{
        success: boolean;
    }>;
    getStats(apiKey?: ApiKey): Promise<{
        total: number;
        active: number;
        ready: number;
        disconnected: number;
        byStatus: Record<string, number>;
        memoryUsage: {
            heapUsed: number;
            heapTotal: number;
            rss: number;
        };
    }>;
}
