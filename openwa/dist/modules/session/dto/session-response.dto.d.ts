import type { Session } from '../entities/session.entity';
import { SessionStatus } from '../entities/session.entity';
export declare class SessionResponseDto {
    id: string;
    name: string;
    status: SessionStatus;
    phone?: string | null;
    pushName?: string | null;
    connectedAt?: Date | null;
    lastActive?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lastError?: string | null;
    static fromEntity(session: Session): SessionResponseDto;
}
export declare class QRCodeResponseDto {
    qrCode: string;
    status: SessionStatus;
}
