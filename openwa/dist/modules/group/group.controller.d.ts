import { GroupService } from './group.service';
import { CreateGroupDto, ParticipantsDto, GroupSubjectDto, GroupDescriptionDto } from './dto/group.dto';
export declare class GroupController {
    private readonly groupService;
    constructor(groupService: GroupService);
    findOne(sessionId: string, groupId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").GroupInfo>;
    create(sessionId: string, dto: CreateGroupDto): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Group>;
    addParticipants(sessionId: string, groupId: string, dto: ParticipantsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    removeParticipants(sessionId: string, groupId: string, dto: ParticipantsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    promoteParticipants(sessionId: string, groupId: string, dto: ParticipantsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    demoteParticipants(sessionId: string, groupId: string, dto: ParticipantsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    setSubject(sessionId: string, groupId: string, dto: GroupSubjectDto): Promise<{
        success: boolean;
        message: string;
    }>;
    setDescription(sessionId: string, groupId: string, dto: GroupDescriptionDto): Promise<{
        success: boolean;
        message: string;
    }>;
    leave(sessionId: string, groupId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getInviteCode(sessionId: string, groupId: string): Promise<{
        inviteCode: string;
        inviteLink: string;
    }>;
    revokeInviteCode(sessionId: string, groupId: string): Promise<{
        inviteCode: string;
        inviteLink: string;
        message: string;
    }>;
}
