import type { GroupMetadata } from '@whiskeysockets/baileys';
import { Group, GroupInfo } from '../interfaces/whatsapp-engine.interface';
type NormalizeJid = (jid: string) => string;
export declare function mapBaileysGroup(metadata: GroupMetadata, selfJid: string, normalizeJid?: NormalizeJid): Group;
export declare function mapBaileysGroupInfo(metadata: GroupMetadata, normalizeJid?: NormalizeJid): GroupInfo;
export {};
