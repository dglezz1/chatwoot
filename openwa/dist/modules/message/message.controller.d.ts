import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import { SendTextMessageDto, SendMediaMessageDto, SendAudioMessageDto, MessageResponseDto } from './dto';
import { SendTemplateMessageDto } from './dto/send-template.dto';
import { SendBulkMessageDto, BulkMessageResponseDto } from './dto/bulk-message.dto';
import { SendLocationDto, SendContactDto, SendPollDto, ReplyMessageDto, ForwardMessageDto, ReactMessageDto, DeleteMessageDto } from './dto/message-actions.dto';
export declare class MessageController {
    private readonly messageService;
    private readonly bulkMessageService;
    constructor(messageService: MessageService, bulkMessageService: BulkMessageService);
    getMessages(sessionId: string, chatId?: string, from?: string, limit?: string, offset?: string): Promise<{
        messages: import("./entities/message.entity").Message[];
        total: number;
    }>;
    sendText(sessionId: string, dto: SendTextMessageDto): Promise<MessageResponseDto>;
    sendTemplate(sessionId: string, dto: SendTemplateMessageDto): Promise<MessageResponseDto>;
    sendImage(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendVideo(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendAudio(sessionId: string, dto: SendAudioMessageDto): Promise<MessageResponseDto>;
    sendDocument(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendLocation(sessionId: string, dto: SendLocationDto): Promise<MessageResponseDto>;
    sendContact(sessionId: string, dto: SendContactDto): Promise<MessageResponseDto>;
    sendSticker(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendPoll(sessionId: string, dto: SendPollDto): Promise<MessageResponseDto>;
    reply(sessionId: string, dto: ReplyMessageDto): Promise<MessageResponseDto>;
    forward(sessionId: string, dto: ForwardMessageDto): Promise<MessageResponseDto>;
    react(sessionId: string, dto: ReactMessageDto): Promise<{
        success: boolean;
    }>;
    getChatHistory(sessionId: string, chatId: string, limit?: string, includeMedia?: string, deep?: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").IncomingMessage[]>;
    getReactions(sessionId: string, chatId: string, messageId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").MessageReaction[]>;
    deleteMessage(sessionId: string, dto: DeleteMessageDto): Promise<{
        success: boolean;
    }>;
    sendBulk(sessionId: string, dto: SendBulkMessageDto): Promise<BulkMessageResponseDto>;
    getBatchStatus(sessionId: string, batchId: string): Promise<{
        batchId: string;
        status: import("./entities/message-batch.entity").BatchStatus;
        progress: import("./entities/message-batch.entity").BatchProgress;
        results: import("./entities/message-batch.entity").BatchMessageResult[];
        startedAt: Date | null;
        completedAt: Date | null;
    }>;
    cancelBatch(sessionId: string, batchId: string): Promise<{
        batchId: string;
        status: import("./entities/message-batch.entity").BatchStatus;
        progress: import("./entities/message-batch.entity").BatchProgress;
    }>;
}
