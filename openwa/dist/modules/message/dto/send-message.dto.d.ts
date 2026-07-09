export declare class SendTextMessageDto {
    chatId: string;
    text: string;
    mentions?: string[];
}
export declare class SendMediaMessageDto {
    chatId: string;
    url?: string;
    base64?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;
    mentions?: string[];
}
export declare class SendAudioMessageDto extends SendMediaMessageDto {
    ptt?: boolean;
}
export declare class MessageResponseDto {
    messageId: string;
    timestamp: number;
}
