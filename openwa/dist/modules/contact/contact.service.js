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
exports.ContactService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../session/session.service");
const paginate_1 = require("../../common/utils/paginate");
let ContactService = class ContactService {
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
    getContacts(sessionId, opts = {}) {
        return this.getEngine(sessionId)
            .getContacts()
            .then(contacts => (0, paginate_1.paginate)(contacts, opts.limit, opts.offset));
    }
    async getContactById(sessionId, contactId) {
        const contact = await this.getEngine(sessionId).getContactById(contactId);
        if (!contact) {
            throw new common_1.NotFoundException(`Contact ${contactId} not found`);
        }
        return contact;
    }
    checkNumberExists(sessionId, number) {
        return this.getEngine(sessionId).checkNumberExists(number);
    }
    getNumberId(sessionId, number) {
        return this.getEngine(sessionId).getNumberId(number);
    }
    resolveContactPhone(sessionId, contactId) {
        return this.getEngine(sessionId).resolveContactPhone(contactId);
    }
    getProfilePicture(sessionId, contactId) {
        return this.getEngine(sessionId).getProfilePicture(contactId);
    }
    blockContact(sessionId, contactId) {
        return this.getEngine(sessionId).blockContact(contactId);
    }
    unblockContact(sessionId, contactId) {
        return this.getEngine(sessionId).unblockContact(contactId);
    }
};
exports.ContactService = ContactService;
exports.ContactService = ContactService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], ContactService);
//# sourceMappingURL=contact.service.js.map