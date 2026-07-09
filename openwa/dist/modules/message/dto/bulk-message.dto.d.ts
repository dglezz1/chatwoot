declare class BulkMediaDto {
    url?: string;
    base64?: string;
    mimetype?: string;
    filename?: string;
    ptt?: boolean;
}
declare class BulkMessageContentDto {
    text?: string;
    image?: BulkMediaDto;
    video?: BulkMediaDto;
    audio?: BulkMediaDto;
    document?: BulkMediaDto;
    caption?: string;
}
declare class BulkMessageItemDto {
    chatId: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'document';
    content: BulkMessageContentDto;
    variables?: Record<string, string>;
}
declare class BulkMessageOptionsDto {
    delayBetweenMessages?: number;
    randomizeDelay?: boolean;
    stopOnError?: boolean;
}
export declare class SendBulkMessageDto {
    batchId?: string;
    messages: BulkMessageItemDto[];
    options?: BulkMessageOptionsDto;
}
export declare class BulkMessageResponseDto {
    batchId: string;
    status: string;
    totalMessages: number;
    estimatedCompletionTime?: string;
    statusUrl: string;
}
export {};
