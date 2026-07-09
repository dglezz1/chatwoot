import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import type { WSClientMessage, WSSubscribedResponse, WSUnsubscribedResponse, WSErrorResponse, WSPongResponse } from './dto/ws-messages.dto';
import type { DeliveryStatus } from '../../engine/interfaces/whatsapp-engine.interface';
export declare function isSessionSubscriptionAllowed(allowedSessions: string[] | null | undefined, sessionId: string): boolean;
export declare class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly authService;
    private readonly auditService;
    server: Server;
    private logger;
    constructor(authService: AuthService, auditService: AuditService);
    afterInit(): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleMessage(client: Socket, message: WSClientMessage): WSUnsubscribedResponse | WSErrorResponse | WSPongResponse | Promise<WSSubscribedResponse | WSErrorResponse>;
    private handleSubscribe;
    private handleUnsubscribe;
    private handlePing;
    private createError;
    private emitToRooms;
    emitSessionStatus(sessionId: string, status: string, data?: Record<string, unknown>): void;
    emitSessionAuthenticated(sessionId: string, data: {
        phone: string;
        pushName: string;
    }): void;
    emitSessionDisconnected(sessionId: string, data: {
        reason: string;
    }): void;
    emitQRCode(sessionId: string, qrCode: string): void;
    emitMessage(sessionId: string, message: Record<string, unknown>): void;
    emitMessageSent(sessionId: string, message: Record<string, unknown>): void;
    emitMessageAck(sessionId: string, data: {
        id: string;
        messageId: string;
        status: DeliveryStatus;
        ack: number;
    }): void;
    emitMessageRevoked(sessionId: string, message: Record<string, unknown>): void;
    emitMessageReaction(sessionId: string, data: Record<string, unknown>): void;
}
