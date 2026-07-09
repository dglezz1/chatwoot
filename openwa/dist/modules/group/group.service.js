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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../session/session.service");
const paginate_1 = require("../../common/utils/paginate");
let GroupService = class GroupService {
    sessionService;
    constructor(sessionService) {
        this.sessionService = sessionService;
    }
    getEngine(sessionId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine;
    }
    getGroups(sessionId, opts = {}) {
        return this.getEngine(sessionId)
            .getGroups()
            .then(groups => (0, paginate_1.paginate)(groups, opts.limit, opts.offset));
    }
    async getGroupInfo(sessionId, groupId) {
        const group = await this.getEngine(sessionId).getGroupInfo(groupId);
        if (!group) {
            throw new common_1.NotFoundException(`Group ${groupId} not found`);
        }
        return group;
    }
    createGroup(sessionId, name, participants) {
        return this.getEngine(sessionId).createGroup(name, participants);
    }
    addParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).addParticipants(groupId, participants);
    }
    removeParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).removeParticipants(groupId, participants);
    }
    promoteParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).promoteParticipants(groupId, participants);
    }
    demoteParticipants(sessionId, groupId, participants) {
        return this.getEngine(sessionId).demoteParticipants(groupId, participants);
    }
    setGroupSubject(sessionId, groupId, subject) {
        return this.getEngine(sessionId).setGroupSubject(groupId, subject);
    }
    setGroupDescription(sessionId, groupId, description) {
        return this.getEngine(sessionId).setGroupDescription(groupId, description);
    }
    leaveGroup(sessionId, groupId) {
        return this.getEngine(sessionId).leaveGroup(groupId);
    }
    getGroupInviteCode(sessionId, groupId) {
        return this.getEngine(sessionId).getGroupInviteCode(groupId);
    }
    revokeGroupInviteCode(sessionId, groupId) {
        return this.getEngine(sessionId).revokeGroupInviteCode(groupId);
    }
};
exports.GroupService = GroupService;
exports.GroupService = GroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], GroupService);
//# sourceMappingURL=group.service.js.map