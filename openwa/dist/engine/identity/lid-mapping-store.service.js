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
exports.LidMappingStoreService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lid_mapping_entity_1 = require("./lid-mapping.entity");
const logger_service_1 = require("../../common/services/logger.service");
let LidMappingStoreService = class LidMappingStoreService {
    repo;
    logger = (0, logger_service_1.createLogger)('LidMappingStore');
    lidToPhone = new Map();
    phoneToLids = new Map();
    constructor(repo) {
        this.repo = repo;
    }
    async onModuleInit() {
        try {
            const rows = await this.repo.find();
            for (const row of rows) {
                this.index(row.lid, row.phone);
            }
            this.logger.log(`Loaded ${rows.length} lid->phone mappings into cache`);
        }
        catch (err) {
            this.logger.warn(`Could not preload lid->phone mappings: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    getCached(lid) {
        return this.lidToPhone.get(lid);
    }
    lidsForPhone(phone) {
        const set = this.phoneToLids.get(phone);
        return set ? [...set] : [];
    }
    async remember(lid, phone, sessionId) {
        if (!lid || this.lidToPhone.get(lid) === phone) {
            return;
        }
        this.index(lid, phone);
        try {
            await this.repo.upsert({ lid, phone, sessionId: sessionId ?? null, updatedAt: new Date() }, ['lid']);
        }
        catch (err) {
            this.logger.warn(`Failed to persist lid->phone mapping for ${lid}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    index(lid, phone) {
        const prev = this.lidToPhone.get(lid);
        if (prev && prev !== phone) {
            this.phoneToLids.get(prev)?.delete(lid);
        }
        this.lidToPhone.set(lid, phone);
        if (phone) {
            const set = this.phoneToLids.get(phone) ?? new Set();
            set.add(lid);
            this.phoneToLids.set(phone, set);
        }
    }
};
exports.LidMappingStoreService = LidMappingStoreService;
exports.LidMappingStoreService = LidMappingStoreService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lid_mapping_entity_1.LidMapping, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], LidMappingStoreService);
//# sourceMappingURL=lid-mapping-store.service.js.map