import { ContactService } from './contact.service';
export declare class ContactController {
    private readonly contactService;
    constructor(contactService: ContactService);
    findAll(sessionId: string, limit?: string, offset?: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact[]>;
    findOne(sessionId: string, contactId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Contact>;
    checkNumber(sessionId: string, number: string): Promise<{
        number: string;
        exists: boolean;
        whatsappId: string | null;
    }>;
    getProfilePicture(sessionId: string, contactId: string): Promise<{
        url: string | null;
    }>;
    resolvePhone(sessionId: string, contactId: string): Promise<{
        contactId: string;
        phone: string | null;
    }>;
    blockContact(sessionId: string, contactId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    unblockContact(sessionId: string, contactId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
