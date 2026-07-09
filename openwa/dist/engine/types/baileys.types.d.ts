import type { WAMessage } from '@whiskeysockets/baileys';
import type { LidMappingStore } from '../identity/lid-mapping-store.service';
export interface BaileysMessageStore {
    put(sessionId: string, msg: WAMessage): Promise<void>;
    getMessage(sessionId: string, messageId: string): Promise<WAMessage | null>;
    clearSession(sessionId: string): Promise<void>;
}
export interface BaileysAdapterConfig {
    sessionId: string;
    authDir: string;
    proxyUrl?: string;
    proxyType?: 'http' | 'https' | 'socks4' | 'socks5';
    messageStore?: BaileysMessageStore;
    lidMappingStore?: LidMappingStore;
}
export interface BaileysLogger {
    level: string;
    child: (bindings: Record<string, unknown>) => BaileysLogger;
    trace: (obj: unknown, msg?: string) => void;
    debug: (obj: unknown, msg?: string) => void;
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
}
