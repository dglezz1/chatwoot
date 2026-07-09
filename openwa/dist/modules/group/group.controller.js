"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const group_service_1 = require("./group.service");
const group_dto_1 = require("./dto/group.dto");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let GroupController = class GroupController {
    groupService;
    constructor(groupService) {
        this.groupService = groupService;
    }
    async findOne(sessionId, groupId) {
        return this.groupService.getGroupInfo(sessionId, groupId);
    }
    async create(sessionId, dto) {
        return this.groupService.createGroup(sessionId, dto.name, dto.participants);
    }
    async addParticipants(sessionId, groupId, dto) {
        await this.groupService.addParticipants(sessionId, groupId, dto.participants);
        return { success: true, message: 'Participants added' };
    }
    async removeParticipants(sessionId, groupId, dto) {
        await this.groupService.removeParticipants(sessionId, groupId, dto.participants);
        return { success: true, message: 'Participants removed' };
    }
    async promoteParticipants(sessionId, groupId, dto) {
        await this.groupService.promoteParticipants(sessionId, groupId, dto.participants);
        return { success: true, message: 'Participants promoted to admin' };
    }
    async demoteParticipants(sessionId, groupId, dto) {
        await this.groupService.demoteParticipants(sessionId, groupId, dto.participants);
        return { success: true, message: 'Participants demoted from admin' };
    }
    async setSubject(sessionId, groupId, dto) {
        await this.groupService.setGroupSubject(sessionId, groupId, dto.subject);
        return { success: true, message: 'Group subject updated' };
    }
    async setDescription(sessionId, groupId, dto) {
        await this.groupService.setGroupDescription(sessionId, groupId, dto.description);
        return { success: true, message: 'Group description updated' };
    }
    async leave(sessionId, groupId) {
        await this.groupService.leaveGroup(sessionId, groupId);
        return { success: true, message: 'Left the group' };
    }
    async getInviteCode(sessionId, groupId) {
        const inviteCode = await this.groupService.getGroupInviteCode(sessionId, groupId);
        return {
            inviteCode,
            inviteLink: `https://chat.whatsapp.com/${inviteCode}`,
        };
    }
    async revokeInviteCode(sessionId, groupId) {
        const newCode = await this.groupService.revokeGroupInviteCode(sessionId, groupId);
        return {
            inviteCode: newCode,
            inviteLink: `https://chat.whatsapp.com/${newCode}`,
            message: 'Invite code revoked and new one generated',
        };
    }
};
exports.GroupController = GroupController;
__decorate([
    (0, common_1.Get)(':groupId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get detailed group info' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID (e.g., 120363xxx@g.us)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Group details with participants' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Group not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new group' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.CreateGroupDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Group created' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, group_dto_1.CreateGroupDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':groupId/participants'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Add participants to a group' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.ParticipantsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Participants added' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, group_dto_1.ParticipantsDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "addParticipants", null);
__decorate([
    (0, common_1.Delete)(':groupId/participants'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Remove participants from a group' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.ParticipantsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Participants removed' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, group_dto_1.ParticipantsDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "removeParticipants", null);
__decorate([
    (0, common_1.Post)(':groupId/participants/promote'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Promote participants to admin' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.ParticipantsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Participants promoted' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, group_dto_1.ParticipantsDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "promoteParticipants", null);
__decorate([
    (0, common_1.Post)(':groupId/participants/demote'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Demote participants from admin' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.ParticipantsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Participants demoted' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, group_dto_1.ParticipantsDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "demoteParticipants", null);
__decorate([
    (0, common_1.Put)(':groupId/subject'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Change group name/subject' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.GroupSubjectDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subject updated' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, group_dto_1.GroupSubjectDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "setSubject", null);
__decorate([
    (0, common_1.Put)(':groupId/description'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Change group description' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiBody)({ type: group_dto_1.GroupDescriptionDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Description updated' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, group_dto_1.GroupDescriptionDto]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "setDescription", null);
__decorate([
    (0, common_1.Post)(':groupId/leave'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Leave a group' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Left the group' }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "leave", null);
__decorate([
    (0, common_1.Get)(':groupId/invite-code'),
    (0, swagger_1.ApiOperation)({ summary: 'Get group invite code/link' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Group invite code' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "getInviteCode", null);
__decorate([
    (0, common_1.Post)(':groupId/invite-code/revoke'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Revoke group invite code and generate new one' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'groupId', description: 'Group ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'New invite code generated' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GroupController.prototype, "revokeInviteCode", null);
exports.GroupController = GroupController = __decorate([
    (0, swagger_1.ApiTags)('groups'),
    (0, common_1.Controller)('sessions/:sessionId/groups'),
    __metadata("design:paramtypes", [group_service_1.GroupService])
], GroupController);
//# sourceMappingURL=group.controller.js.map