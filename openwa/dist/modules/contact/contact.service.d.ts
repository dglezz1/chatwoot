import { SessionService } from '../session/session.service';
import { ListOptions } from '../../common/utils/paginate';
export declare class ContactService {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    private getEngine;
    getContacts(sessionId: string, opts?: ListOptions): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact[]>;
    getContactById(sessionId: string, contactId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact>;
    checkNumberExists(sessionId: string, number: string): Promise<boolean>;
    getNumberId(sessionId: string, number: string): Promise<string | null>;
    resolveContactPhone(sessionId: string, contactId: string): Promise<string | null>;
    getProfilePicture(sessionId: string, contactId: string): Promise<string | null>;
    blockContact(sessionId: string, contactId: string): Promise<void>;
    unblockContact(sessionId: string, contactId: string): Promise<void>;
}
