import { SessionService } from '../session/session.service';
import { ListOptions } from '../../common/utils/paginate';
export declare class GroupService {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    private getEngine;
    getGroups(sessionId: string, opts?: ListOptions): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Group[]>;
    getGroupInfo(sessionId: string, groupId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").GroupInfo>;
    createGroup(sessionId: string, name: string, participants: string[]): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Group>;
    addParticipants(sessionId: string, groupId: string, participants: string[]): Promise<void>;
    removeParticipants(sessionId: string, groupId: string, participants: string[]): Promise<void>;
    promoteParticipants(sessionId: string, groupId: string, participants: string[]): Promise<void>;
    demoteParticipants(sessionId: string, groupId: string, participants: string[]): Promise<void>;
    setGroupSubject(sessionId: string, groupId: string, subject: string): Promise<void>;
    setGroupDescription(sessionId: string, groupId: string, description: string): Promise<void>;
    leaveGroup(sessionId: string, groupId: string): Promise<void>;
    getGroupInviteCode(sessionId: string, groupId: string): Promise<string>;
    revokeGroupInviteCode(sessionId: string, groupId: string): Promise<string>;
}
