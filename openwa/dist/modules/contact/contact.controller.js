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
exports.ContactController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const contact_service_1 = require("./contact.service");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
let ContactController = class ContactController {
    contactService;
    constructor(contactService) {
        this.contactService = contactService;
    }
    async findAll(sessionId, limit, offset) {
        return this.contactService.getContacts(sessionId, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }
    async findOne(sessionId, contactId) {
        return this.contactService.getContactById(sessionId, contactId);
    }
    async checkNumber(sessionId, number) {
        const whatsappId = await this.contactService.getNumberId(sessionId, number);
        return {
            number,
            exists: whatsappId !== null,
            whatsappId,
        };
    }
    async getProfilePicture(sessionId, contactId) {
        const url = await this.contactService.getProfilePicture(sessionId, contactId);
        return { url };
    }
    async resolvePhone(sessionId, contactId) {
        const phone = await this.contactService.resolveContactPhone(sessionId, contactId);
        return { contactId, phone };
    }
    async blockContact(sessionId, contactId) {
        await this.contactService.blockContact(sessionId, contactId);
        return { success: true, message: 'Contact blocked' };
    }
    async unblockContact(sessionId, contactId) {
        await this.contactService.unblockContact(sessionId, contactId);
        return { success: true, message: 'Contact unblocked' };
    }
};
exports.ContactController = ContactController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all contacts for a session' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of contacts',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Session not ready' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Max contacts to return (1–1000, default 1000)' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of contacts to skip (for paging)' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':contactId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific contact by ID' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Contact details',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Contact not found' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('check/:number'),
    (0, swagger_1.ApiOperation)({ summary: 'Check if a phone number exists on WhatsApp' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'number', description: 'Phone number to check (e.g., 628123456789)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Number existence check result',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('number')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "checkNumber", null);
__decorate([
    (0, common_1.Get)(':contactId/profile-picture'),
    (0, swagger_1.ApiOperation)({ summary: 'Get profile picture URL for a contact' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Profile picture URL',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "getProfilePicture", null);
__decorate([
    (0, common_1.Get)(':contactId/phone'),
    (0, swagger_1.ApiOperation)({ summary: 'Resolve a contact id (e.g. an @lid) to a phone number — best-effort' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'contactId', description: 'Contact ID / JID to resolve (e.g., an @lid)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Resolved phone number (MSISDN digits), or null when the engine cannot map it',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "resolvePhone", null);
__decorate([
    (0, common_1.Post)(':contactId/block'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Block a contact' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Contact blocked',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "blockContact", null);
__decorate([
    (0, common_1.Delete)(':contactId/block'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Unblock a contact' }),
    (0, swagger_1.ApiParam)({ name: 'sessionId', description: 'Session ID' }),
    (0, swagger_1.ApiParam)({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Contact unblocked',
    }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ContactController.prototype, "unblockContact", null);
exports.ContactController = ContactController = __decorate([
    (0, swagger_1.ApiTags)('contacts'),
    (0, common_1.Controller)('sessions/:sessionId/contacts'),
    __metadata("design:paramtypes", [contact_service_1.ContactService])
], ContactController);
//# sourceMappingURL=contact.controller.js.map