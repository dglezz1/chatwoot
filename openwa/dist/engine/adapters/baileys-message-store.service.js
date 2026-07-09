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
exports.BaileysMessageStoreService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const baileys_stored_message_entity_1 = require("./baileys-stored-message.entity");
const logger_service_1 = require("../../common/services/logger.service");
function positiveIntFromEnv(name, fallback) {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function isMissingParentSessionError(err) {
    const e = err;
    const code = e?.driverError?.code ?? e?.code;
    if (code === '23503') {
        return true;
    }
    const message = e?.message ?? '';
    if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) {
        return code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || /FOREIGN KEY/i.test(message);
    }
    return /FOREIGN KEY constraint failed/i.test(message);
}
let BaileysMessageStoreService = class BaileysMessageStoreService {
    repo;
    logger = (0, logger_service_1.createLogger)('BaileysMessageStore');
    orphanWarnedSessions = new Set();
    baileysLib;
    async loadLib() {
        return (this.baileysLib ??= await import('@whiskeysockets/baileys'));
    }
    constructor(repo) {
        this.repo = repo;
    }
    async put(sessionId, msg) {
        const waMessageId = msg.key?.id;
        if (!waMessageId) {
            return;
        }
        const { BufferJSON } = await this.loadLib();
        const serializedMessage = JSON.stringify(msg, BufferJSON.replacer);
        try {
            await this.repo.upsert({ sessionId, waMessageId, serializedMessage, createdAt: new Date() }, [
                'sessionId',
                'waMessageId',
            ]);
        }
        catch (err) {
            if (isMissingParentSessionError(err)) {
                if (!this.orphanWarnedSessions.has(sessionId)) {
                    this.orphanWarnedSessions.add(sessionId);
                    this.logger.warn(`No parent session row for "${sessionId}" — skipping Baileys message store (orphaned/recreated session). ` +
                        `reply/forward/react/delete-by-id will be unavailable for messages received under this id.`);
                }
                return;
            }
            throw err;
        }
        await this.enforceLimit(sessionId);
    }
    async getMessage(sessionId, messageId) {
        const row = await this.repo.findOne({ where: { sessionId, waMessageId: messageId } });
        if (!row) {
            return null;
        }
        const { BufferJSON } = await this.loadLib();
        return JSON.parse(row.serializedMessage, BufferJSON.reviver);
    }
    async clearSession(sessionId) {
        await this.repo.delete({ sessionId });
    }
    async enforceLimit(sessionId) {
        const limit = positiveIntFromEnv('BAILEYS_MESSAGE_STORE_LIMIT', 5000);
        const cutoff = await this.repo.find({
            where: { sessionId },
            order: { createdAt: 'DESC', id: 'DESC' },
            skip: limit,
            take: 1,
            select: ['id', 'createdAt'],
        });
        if (cutoff.length === 0) {
            return;
        }
        const { id, createdAt } = cutoff[0];
        await this.repo
            .createQueryBuilder()
            .delete()
            .where('sessionId = :sessionId', { sessionId })
            .andWhere('(createdAt < :createdAt OR (createdAt = :createdAt AND id <= :id))', { createdAt, id })
            .execute();
    }
};
exports.BaileysMessageStoreService = BaileysMessageStoreService;
exports.BaileysMessageStoreService = BaileysMessageStoreService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(baileys_stored_message_entity_1.BaileysStoredMessage, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BaileysMessageStoreService);
//# sourceMappingURL=baileys-message-store.service.js.map