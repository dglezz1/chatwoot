export type WaIdKind = 'user' | 'group' | 'lid' | 'status' | 'newsletter' | 'broadcast' | 'unknown';
export interface ParsedWaId {
    kind: WaIdKind;
    userPart: string;
    device?: string;
    raw: string;
}
export declare function userPart(jid: string): string;
export declare function parseWaId(jid: string): ParsedWaId;
export declare function toNeutralJid(jid: string, resolvePhone?: (jid: string) => string | null): string;
export declare function isChannelJid(jid: string): boolean;
