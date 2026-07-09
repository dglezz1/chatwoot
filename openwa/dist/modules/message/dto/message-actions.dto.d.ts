export declare class SendLocationDto {
    chatId: string;
    latitude: number;
    longitude: number;
    description?: string;
    address?: string;
}
export declare class SendContactDto {
    chatId: string;
    contactName: string;
    contactNumber: string;
}
export declare class SendPollDto {
    chatId: string;
    name: string;
    options: string[];
    allowMultipleAnswers?: boolean;
}
export declare class ReplyMessageDto {
    chatId: string;
    quotedMessageId: string;
    text: string;
}
export declare class ForwardMessageDto {
    fromChatId: string;
    toChatId: string;
    messageId: string;
}
export declare class ReactMessageDto {
    chatId: string;
    messageId: string;
    emoji: string;
}
export declare class DeleteMessageDto {
    chatId: string;
    messageId: string;
    forEveryone?: boolean;
}
