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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = exports.CACHE_QUIT_TIMEOUT_MS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_service_1 = require("../services/logger.service");
const TTL = {
    SESSION_STATUS: 300,
    SESSION_INFO: 600,
    SESSION_QR: 60,
    SESSIONS_LIST: 30,
    SESSIONS_STATS: 15,
};
exports.CACHE_QUIT_TIMEOUT_MS = 2000;
let CacheService = class CacheService {
    configService;
    logger = (0, logger_service_1.createLogger)('CacheService');
    redis = null;
    enabled;
    connecting = false;
    connectionAttempts = 0;
    maxConnectionAttempts = 5;
    constructor(configService) {
        this.configService = configService;
        this.enabled = process.env.REDIS_ENABLED === 'true' || configService.get('cache.enabled', false);
        this.logger.log(`CacheService: enabled=${this.enabled}, REDIS_ENABLED=${process.env.REDIS_ENABLED}`);
    }
    async tryConnect() {
        if (!this.enabled)
            return false;
        if (this.connecting)
            return false;
        if (this.redis && (await this.ping()))
            return true;
        this.connecting = true;
        this.connectionAttempts++;
        try {
            const host = process.env.REDIS_HOST || this.configService.get('REDIS_HOST', 'localhost');
            const port = parseInt(process.env.REDIS_PORT || '', 10) || this.configService.get('REDIS_PORT', 6379);
            this.logger.log(`Connecting to Redis at ${host}:${port} (attempt ${this.connectionAttempts})`);
            this.redis = new ioredis_1.default({
                host,
                port,
                username: this.configService.get('REDIS_USERNAME'),
                password: this.configService.get('REDIS_PASSWORD'),
                db: this.configService.get('REDIS_CACHE_DB', 1),
                lazyConnect: true,
                maxRetriesPerRequest: 3,
                connectTimeout: this.configService.get('redis.connectTimeoutMs', 5000),
                retryStrategy: times => {
                    if (times > 3)
                        return null;
                    return Math.min(times * 500, 3000);
                },
            });
            this.redis.on('error', err => {
                this.logger.warn(`Redis error: ${err.message}`);
            });
            this.redis.on('connect', () => {
                this.logger.log('Redis cache connected');
                this.connectionAttempts = 0;
            });
            await this.redis.connect();
            this.connecting = false;
            return true;
        }
        catch (error) {
            this.logger.warn(`Redis connection failed (attempt ${this.connectionAttempts}): ${String(error)}`);
            this.redis = null;
            this.connecting = false;
            return false;
        }
    }
    async ping() {
        if (!this.redis)
            return false;
        try {
            await this.redis.ping();
            return true;
        }
        catch (error) {
            this.logger.debug(`Redis ping failed: ${String(error)}`);
            return false;
        }
    }
    async onModuleDestroy() {
        if (!this.redis)
            return;
        const redis = this.redis;
        let timer;
        const forceDisconnect = new Promise(resolve => {
            timer = setTimeout(() => {
                redis.disconnect();
                resolve();
            }, exports.CACHE_QUIT_TIMEOUT_MS);
            timer.unref();
        });
        try {
            await Promise.race([redis.quit().catch(() => undefined), forceDisconnect]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async isAvailable() {
        if (!this.enabled)
            return false;
        if (!this.redis && this.connectionAttempts < this.maxConnectionAttempts) {
            await this.tryConnect();
        }
        return this.ping();
    }
    async getSessionStatus(id) {
        if (!(await this.isAvailable()))
            return null;
        try {
            return await this.redis.get(`session:${id}:status`);
        }
        catch (error) {
            this.logger.warn(`Cache read failed (session:status): ${String(error)}`);
            return null;
        }
    }
    async setSessionStatus(id, status) {
        if (!(await this.isAvailable()))
            return;
        try {
            await this.redis.setex(`session:${id}:status`, TTL.SESSION_STATUS, status);
        }
        catch (error) {
            this.logger.warn(`Cache write failed (session:status): ${String(error)}`);
        }
    }
    async getSessionInfo(id) {
        if (!(await this.isAvailable()))
            return null;
        try {
            const data = await this.redis.get(`session:${id}:info`);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            this.logger.warn(`Cache read failed (session:info): ${String(error)}`);
            return null;
        }
    }
    async setSessionInfo(id, info) {
        if (!(await this.isAvailable()))
            return;
        try {
            await this.redis.setex(`session:${id}:info`, TTL.SESSION_INFO, JSON.stringify(info));
        }
        catch (error) {
            this.logger.warn(`Cache write failed (session:info): ${String(error)}`);
        }
    }
    async getSessionQR(id) {
        if (!(await this.isAvailable()))
            return null;
        try {
            return await this.redis.get(`session:${id}:qr`);
        }
        catch (error) {
            this.logger.warn(`Cache read failed (session:qr): ${String(error)}`);
            return null;
        }
    }
    async setSessionQR(id, qr) {
        if (!(await this.isAvailable()))
            return;
        try {
            await this.redis.setex(`session:${id}:qr`, TTL.SESSION_QR, qr);
        }
        catch (error) {
            this.logger.warn(`Cache write failed (session:qr): ${String(error)}`);
        }
    }
    async getSessionsList() {
        if (!(await this.isAvailable()))
            return null;
        try {
            const data = await this.redis.get('sessions:list');
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            this.logger.warn(`Cache read failed (sessions:list): ${String(error)}`);
            return null;
        }
    }
    async setSessionsList(ids) {
        if (!(await this.isAvailable()))
            return;
        try {
            await this.redis.setex('sessions:list', TTL.SESSIONS_LIST, JSON.stringify(ids));
        }
        catch (error) {
            this.logger.warn(`Cache write failed (sessions:list): ${String(error)}`);
        }
    }
    async getSessionsStats() {
        if (!(await this.isAvailable()))
            return null;
        try {
            const data = await this.redis.get('sessions:stats');
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            this.logger.warn(`Cache read failed (sessions:stats): ${String(error)}`);
            return null;
        }
    }
    async setSessionsStats(stats) {
        if (!(await this.isAvailable()))
            return;
        try {
            await this.redis.setex('sessions:stats', TTL.SESSIONS_STATS, JSON.stringify(stats));
        }
        catch (error) {
            this.logger.warn(`Cache write failed (sessions:stats): ${String(error)}`);
        }
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CacheService);
//# sourceMappingURL=cache.service.js.map