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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
exports.resolveSeedApiKey = resolveSeedApiKey;
exports.bannerKeyLine = bannerKeyLine;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const secret_file_1 = require("../../common/utils/secret-file");
const ip_1 = require("../../common/utils/ip");
const api_key_hash_1 = require("./api-key-hash");
const api_key_entity_1 = require("./entities/api-key.entity");
const logger_service_1 = require("../../common/services/logger.service");
const API_KEY_FILE = (0, path_1.join)(process.cwd(), 'data', '.api-key');
function resolveSeedApiKey() {
    if (process.env.API_MASTER_KEY) {
        return process.env.API_MASTER_KEY;
    }
    if (process.env.ALLOW_DEV_API_KEY === 'true') {
        return 'dev-admin-key';
    }
    return `owa_k1_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
}
function bannerKeyLine(displayKey, isNewKey) {
    if (isNewKey)
        return displayKey;
    if (displayKey.startsWith('('))
        return displayKey;
    return `${displayKey.slice(0, 8)}… (full key in data/.api-key or the dashboard)`;
}
let AuthService = class AuthService {
    static { AuthService_1 = this; }
    apiKeyRepository;
    logger = (0, logger_service_1.createLogger)('AuthService');
    static STAT_FLUSH_INTERVAL_MS = 60_000;
    pendingUsage = new Map();
    constructor(apiKeyRepository) {
        this.apiKeyRepository = apiKeyRepository;
    }
    async onModuleInit() {
        const count = await this.apiKeyRepository.count();
        let displayKey;
        let isNewKey = false;
        if (count === 0) {
            displayKey = resolveSeedApiKey();
            await this.seedApiKey(displayKey, 'Default Admin Key', api_key_entity_1.ApiKeyRole.ADMIN);
            isNewKey = true;
            try {
                (0, secret_file_1.writeSecretFile)(API_KEY_FILE, displayKey);
            }
            catch (err) {
                this.logger.warn('Could not save API key file', { error: String(err) });
            }
        }
        else {
            if ((0, fs_1.existsSync)(API_KEY_FILE)) {
                try {
                    displayKey = (0, fs_1.readFileSync)(API_KEY_FILE, 'utf-8').trim();
                }
                catch (error) {
                    this.logger.warn(`Failed to read API key file: ${API_KEY_FILE}`, { error: String(error) });
                    displayKey = '(check dashboard for keys)';
                }
            }
            else {
                displayKey = '(check dashboard for keys)';
            }
        }
        const apiBaseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 2785}`;
        const dashboardUrl = process.env.DASHBOARD_URL || apiBaseUrl;
        this.logger.log('');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('');
        this.logger.log('  🟢 Welcome to OpenWA - WhatsApp API Gateway');
        this.logger.log('');
        this.logger.log(`  📊 Dashboard: ${dashboardUrl}`);
        this.logger.log(`  📚 API Docs:  ${apiBaseUrl}/api/docs`);
        this.logger.log('');
        if (isNewKey) {
            this.logger.log('  🔑 API Key (newly created):');
        }
        else {
            this.logger.log('  🔑 API Key:');
        }
        this.logger.log(`     ${bannerKeyLine(displayKey, isNewKey)}`);
        this.logger.log('');
        this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.log('');
    }
    async seedApiKey(rawKey, name, role) {
        const keyHash = this.hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12);
        const apiKey = this.apiKeyRepository.create({
            name,
            keyHash,
            keyPrefix,
            role,
        });
        return this.apiKeyRepository.save(apiKey);
    }
    async createApiKey(dto) {
        const rawKey = `owa_k1_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
        const keyHash = this.hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12);
        const apiKey = this.apiKeyRepository.create({
            name: dto.name,
            keyHash,
            keyPrefix,
            role: dto.role || api_key_entity_1.ApiKeyRole.OPERATOR,
            allowedIps: dto.allowedIps || null,
            allowedSessions: dto.allowedSessions || null,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        });
        const saved = await this.apiKeyRepository.save(apiKey);
        this.logger.log(`API key created: ${saved.name}`, {
            keyId: saved.id,
            role: saved.role,
            action: 'api_key_created',
        });
        return { apiKey: saved, rawKey };
    }
    async findAll() {
        return this.apiKeyRepository.find({
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
        if (!apiKey) {
            throw new common_1.NotFoundException(`API key with id '${id}' not found`);
        }
        return apiKey;
    }
    async update(id, dto) {
        const apiKey = await this.findOne(id);
        if (dto.name)
            apiKey.name = dto.name;
        if (dto.role)
            apiKey.role = dto.role;
        if (dto.allowedIps !== undefined)
            apiKey.allowedIps = dto.allowedIps;
        if (dto.allowedSessions !== undefined)
            apiKey.allowedSessions = dto.allowedSessions;
        if (dto.expiresAt !== undefined)
            apiKey.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
        return this.apiKeyRepository.save(apiKey);
    }
    async delete(id) {
        const apiKey = await this.findOne(id);
        this.pendingUsage.delete(id);
        await this.apiKeyRepository.remove(apiKey);
        this.logger.log(`API key deleted: ${apiKey.name}`, {
            keyId: id,
            action: 'api_key_deleted',
        });
    }
    async revoke(id) {
        const apiKey = await this.findOne(id);
        this.pendingUsage.delete(id);
        apiKey.isActive = false;
        return this.apiKeyRepository.save(apiKey);
    }
    async validateApiKey(rawKey, clientIp, sessionId) {
        const keyHash = this.hashKey(rawKey);
        const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });
        if (!apiKey) {
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        if (!apiKey.isActive) {
            throw new common_1.UnauthorizedException('API key is revoked');
        }
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('API key has expired');
        }
        if (apiKey.allowedIps && apiKey.allowedIps.length > 0) {
            if (!clientIp) {
                throw new common_1.UnauthorizedException('Client IP could not be determined');
            }
            if (!this.isIpAllowed(clientIp, apiKey.allowedIps)) {
                this.logger.warn(`IP not allowed: ${clientIp}`, {
                    keyId: apiKey.id,
                    action: 'ip_rejected',
                });
                throw new common_1.UnauthorizedException('IP address not allowed');
            }
        }
        if (apiKey.allowedSessions && apiKey.allowedSessions.length > 0 && sessionId) {
            if (!apiKey.allowedSessions.includes(sessionId)) {
                throw new common_1.UnauthorizedException('API key not authorized for this session');
            }
        }
        const pending = (this.pendingUsage.get(apiKey.id) ?? 0) + 1;
        const previousLastUsedAt = apiKey.lastUsedAt;
        apiKey.lastUsedAt = new Date();
        apiKey.usageCount += pending;
        const due = !previousLastUsedAt ||
            apiKey.lastUsedAt.getTime() - previousLastUsedAt.getTime() >= AuthService_1.STAT_FLUSH_INTERVAL_MS;
        if (due) {
            this.pendingUsage.delete(apiKey.id);
            await this.apiKeyRepository.save(apiKey);
        }
        else {
            this.pendingUsage.set(apiKey.id, pending);
        }
        return apiKey;
    }
    hashKey(rawKey) {
        return (0, api_key_hash_1.hashApiKey)(rawKey, process.env.API_KEY_PEPPER);
    }
    isIpAllowed(clientIp, allowedIps) {
        return allowedIps.some(entry => (0, ip_1.ipMatches)(clientIp, entry));
    }
    hasPermission(apiKey, requiredRole) {
        const roleHierarchy = {
            [api_key_entity_1.ApiKeyRole.VIEWER]: 1,
            [api_key_entity_1.ApiKeyRole.OPERATOR]: 2,
            [api_key_entity_1.ApiKeyRole.ADMIN]: 3,
        };
        return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(api_key_entity_1.ApiKey, 'main')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map