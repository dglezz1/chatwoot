import { DeliveryStatus, IncomingMessage, MessageType } from '../interfaces/whatsapp-engine.interface';
export declare function mapBaileysMessageType(contentType: string | undefined, isPtt?: boolean): MessageType;
export interface BaileysBodyContent {
    conversation?: string | null;
    extendedTextMessage?: {
        text?: string | null;
    } | null;
    imageMessage?: {
        caption?: string | null;
    } | null;
    videoMessage?: {
        caption?: string | null;
    } | null;
    documentMessage?: {
        caption?: string | null;
    } | null;
    interactiveMessage?: {
        body?: {
            text?: string | null;
        } | null;
    } | null;
    buttonsMessage?: {
        contentText?: string | null;
    } | null;
    templateMessage?: {
        hydratedTemplate?: {
            hydratedContentText?: string | null;
        } | null;
        hydratedFourRowTemplate?: {
            hydratedContentText?: string | null;
        } | null;
    } | null;
    interactiveResponseMessage?: {
        body?: {
            text?: string | null;
        } | null;
    } | null;
}
export declare function extractBaileysBody(content: BaileysBodyContent): string;
export declare function mapBaileysStatus(status: number | null | undefined): DeliveryStatus | null;
export interface BaileysIncomingFields {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
    body: string;
    contentType: string | undefined;
    isPtt?: boolean;
    timestamp: number;
    pushName?: string;
    selfJid?: string;
    media?: IncomingMessage['media'];
    location?: IncomingMessage['location'];
    quotedMessage?: IncomingMessage['quotedMessage'];
    ephemeralDuration?: number;
    mentionedJids?: string[];
}
export declare function buildIncomingMessageFromBaileys(fields: BaileysIncomingFields, normalizeJid?: (jid: string) => string): IncomingMessage;
