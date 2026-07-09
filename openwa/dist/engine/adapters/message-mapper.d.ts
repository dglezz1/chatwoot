import { IncomingMessage, MessageContact, MessageType } from '../interfaces/whatsapp-engine.interface';
export declare function mapWwebjsMessageType(raw: string): MessageType;
export interface RawMessageFields {
    id: {
        _serialized: string;
    };
    from: string;
    to: string;
    body: string;
    type: string;
    timestamp: number;
    fromMe: boolean;
    author?: string;
    mentionedIds?: string[];
    _data?: {
        notifyName?: string;
        ephemeralDuration?: number;
    };
}
export declare function buildIncomingMessageBase(msg: RawMessageFields): IncomingMessage;
export interface RawContactFields {
    id?: {
        _serialized?: string;
    };
    number?: string;
    name?: string;
    pushname?: string;
    shortName?: string;
    type?: string;
    isMyContact?: boolean;
    isWAContact?: boolean;
    isBusiness?: boolean;
    isEnterprise?: boolean;
    verifiedName?: string;
    verifiedLevel?: number;
    isBlocked?: boolean;
    labels?: string[];
}
export declare function mapContactFields(contact: RawContactFields, full?: boolean): MessageContact;
