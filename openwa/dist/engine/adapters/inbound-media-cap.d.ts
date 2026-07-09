import type { IncomingMessage } from '../interfaces/whatsapp-engine.interface';
export declare function inboundMediaMaxBytes(): number;
export declare function inboundMediaConcurrency(): number;
export declare function inboundMediaTimeoutMs(): number;
export declare function withInboundDownloadTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T | null>;
export declare function isMediaDownloadEnabled(): boolean;
export declare function coerceDeclaredSize(value: unknown): number;
type InboundMedia = NonNullable<IncomingMessage['media']>;
export declare function capInboundMedia(args: {
    mimetype: string;
    filename?: string;
    sizeBytes: number;
    toBase64: () => string;
    maxBytes?: number;
}): InboundMedia;
export {};
