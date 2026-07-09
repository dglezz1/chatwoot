import { SessionService } from '../session/session.service';
export declare class LabelService {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    private getEngine;
    getLabels(sessionId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Label[]>;
    getLabelById(sessionId: string, labelId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Label>;
    getChatLabels(sessionId: string, chatId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Label[]>;
    addLabelToChat(sessionId: string, chatId: string, labelId: string): Promise<void>;
    removeLabelFromChat(sessionId: string, chatId: string, labelId: string): Promise<void>;
}
