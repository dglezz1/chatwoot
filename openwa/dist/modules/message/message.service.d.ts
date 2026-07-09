import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { SendTextMessageDto, SendMediaMessageDto, SendAudioMessageDto, MessageResponseDto } from './dto';
import { SendTemplateMessageDto } from './dto/send-template.dto';
import { Message, MessageStatus } from './entities/message.entity';
import { HookManager } from '../../core/hooks';
import { TemplateService } from '../template/template.service';
import { LidMappingStoreService } from '../../engine/identity/lid-mapping-store.service';
export interface GetMessagesOptions {
    chatId?: string;
    from?: string;
    limit?: number;
    offset?: number;
}
export declare class MessageService {
    private readonly messageRepository;
    private readonly sessionService;
    private readonly hookManager;
    private readonly templateService;
    private readonly lidMappingStore;
    private readonly configService?;
    private readonly logger;
    constructor(messageRepository: Repository<Message>, sessionService: SessionService, hookManager: HookManager, templateService: TemplateService, lidMappingStore: LidMappingStoreService, configService?: ConfigService | undefined);
    sendText(sessionId: string, dto: SendTextMessageDto): Promise<MessageResponseDto>;
    private applySendingGate;
    private failSend;
    sendTemplate(sessionId: string, dto: SendTemplateMessageDto): Promise<MessageResponseDto>;
    sendImage(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendVideo(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    sendAudio(sessionId: string, dto: SendAudioMessageDto): Promise<MessageResponseDto>;
    sendDocument(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    getMessages(sessionId: string, options?: GetMessagesOptions): Promise<{
        messages: Message[];
        total: number;
    }>;
    private resolveJidCandidates;
    sendLocation(sessionId: string, dto: {
        chatId: string;
        latitude: number;
        longitude: number;
        description?: string;
        address?: string;
    }): Promise<MessageResponseDto>;
    sendContact(sessionId: string, dto: {
        chatId: string;
        contactName: string;
        contactNumber: string;
    }): Promise<MessageResponseDto>;
    sendPoll(sessionId: string, dto: {
        chatId: string;
        name: string;
        options: string[];
        allowMultipleAnswers?: boolean;
    }): Promise<MessageResponseDto>;
    sendSticker(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto>;
    reply(sessionId: string, dto: {
        chatId: string;
        quotedMessageId: string;
        text: string;
    }): Promise<MessageResponseDto>;
    forward(sessionId: string, dto: {
        fromChatId: string;
        toChatId: string;
        messageId: string;
    }): Promise<MessageResponseDto>;
    saveIncomingMessage(sessionId: string, data: Partial<Message>): Promise<Message>;
    saveOutgoingMessage(sessionId: string, data: {
        waMessageId?: string;
        chatId: string;
        body?: string;
        type: string;
        timestamp?: number;
        status?: MessageStatus;
        metadata?: Record<string, unknown>;
    }): Promise<Message>;
    private saveFailedMessage;
    private persistSentState;
    reactToMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        emoji: string;
    }): Promise<void>;
    getMessageReactions(sessionId: string, chatId: string, messageId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").MessageReaction[]>;
    private static readonly MAX_CHAT_HISTORY_LIMIT;
    private static readonly MAX_DEEP_CHAT_HISTORY_LIMIT;
    getChatHistory(sessionId: string, chatId: string, limit?: number, includeMedia?: boolean, deep?: boolean): Promise<import("../../engine/interfaces/whatsapp-engine.interface").IncomingMessage[]>;
    deleteMessage(sessionId: string, dto: {
        chatId: string;
        messageId: string;
        forEveryone?: boolean;
    }): Promise<void>;
    private getEngine;
    private simulateTypingIfEnabled;
    private toClientFacingError;
    private buildMediaInput;
}
