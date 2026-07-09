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
exports.ConversationMappingService = exports.ConversationMappingConflict = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const conversation_mapping_entity_1 = require("./entities/conversation-mapping.entity");
const db_errors_1 = require("../../common/utils/db-errors");
class ConversationMappingConflict extends Error {
    key;
    providerConversationId;
    constructor(key, providerConversationId) {
        super(`conversation mapping conflict: providerConversationId "${providerConversationId}" is already bound to ` +
            `a different chat for plugin "${key.pluginId}" instance "${key.instanceId}"`);
        this.key = key;
        this.providerConversationId = providerConversationId;
        this.name = 'ConversationMappingConflict';
    }
}
exports.ConversationMappingConflict = ConversationMappingConflict;
let ConversationMappingService = class ConversationMappingService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async upsert(key, providerConversationId, patch) {
        const existing = await this.repo.findOne({ where: key });
        if (existing) {
            await this.updateById(existing.id, key, providerConversationId, patch);
            return;
        }
        try {
            await this.repo.save(this.repo.create({ ...key, providerConversationId, handoverState: 'bot', ...patch }));
        }
        catch (err) {
            if (!(0, db_errors_1.isUniqueViolation)(err))
                throw err;
            const raced = await this.repo.findOne({ where: key });
            if (raced) {
                await this.updateById(raced.id, key, providerConversationId, patch);
                return;
            }
            throw new ConversationMappingConflict(key, providerConversationId);
        }
    }
    async updateById(id, key, providerConversationId, patch) {
        try {
            await this.repo.update({ id }, {
                providerConversationId,
                ...patch,
            });
        }
        catch (err) {
            if ((0, db_errors_1.isUniqueViolation)(err))
                throw new ConversationMappingConflict(key, providerConversationId);
            throw err;
        }
    }
    get(key) {
        return this.repo.findOne({ where: key });
    }
    async findHandoverForChat(sessionId, chatId) {
        const row = await this.repo.findOne({
            where: [
                { sessionId, chatId, handoverState: 'human' },
                { sessionId, chatId, handoverState: 'closed' },
            ],
            order: { updatedAt: 'DESC' },
        });
        return row ? { pluginId: row.pluginId, handoverState: row.handoverState } : null;
    }
    getByProvider(pluginId, instanceId, providerConversationId) {
        return this.repo.findOne({ where: { pluginId, instanceId, providerConversationId } });
    }
    async setHandover(id, state) {
        await this.repo.update({ id }, { handoverState: state });
    }
};
exports.ConversationMappingService = ConversationMappingService;
exports.ConversationMappingService = ConversationMappingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(conversation_mapping_entity_1.ConversationMapping, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ConversationMappingService);
//# sourceMappingURL=conversation-mapping.service.js.map