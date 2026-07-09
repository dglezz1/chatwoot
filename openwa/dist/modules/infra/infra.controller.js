"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var InfraController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const queue_names_1 = require("../queue/queue-names");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
const path_safety_1 = require("../../common/utils/path-safety");
const secret_file_1 = require("../../common/utils/secret-file");
const engine_factory_1 = require("../../engine/engine.factory");
const wa_web_version_1 = require("../../engine/wa-web-version");
const docker_1 = require("../docker");
const cache_service_1 = require("../../common/cache/cache.service");
const storage_service_1 = require("../../common/storage/storage.service");
const shutdown_service_1 = require("../../common/services/shutdown.service");
const logger_service_1 = require("../../common/services/logger.service");
const db_errors_1 = require("../../common/utils/db-errors");
const import_storage_dto_1 = require("./dto/import-storage.dto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const dotenv = __importStar(require("dotenv"));
let InfraController = class InfraController {
    static { InfraController_1 = this; }
    configService;
    mainDataSource;
    dataDataSource;
    engineFactory;
    dockerService;
    cacheService;
    storageService;
    shutdownService;
    webhookQueue;
    logger = (0, logger_service_1.createLogger)('InfraController');
    constructor(configService, mainDataSource, dataDataSource, engineFactory, dockerService, cacheService, storageService, shutdownService, webhookQueue) {
        this.configService = configService;
        this.mainDataSource = mainDataSource;
        this.dataDataSource = dataDataSource;
        this.engineFactory = engineFactory;
        this.dockerService = dockerService;
        this.cacheService = cacheService;
        this.storageService = storageService;
        this.shutdownService = shutdownService;
        this.webhookQueue = webhookQueue;
    }
    static DB_PROBE_TIMEOUT_MS = 3000;
    async probeDbConnected(ds) {
        if (!ds.isInitialized)
            return false;
        let timer;
        try {
            await Promise.race([
                ds.query('SELECT 1'),
                new Promise((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('db probe timeout')), InfraController_1.DB_PROBE_TIMEOUT_MS);
                }),
            ]);
            return true;
        }
        catch {
            return false;
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async getStatus() {
        const [mainDbConnected, dataDbConnected] = await Promise.all([
            this.probeDbConnected(this.mainDataSource),
            this.probeDbConnected(this.dataDataSource),
        ]);
        const dbConnected = mainDbConnected && dataDbConnected;
        const dbType = this.configService.get('dataDatabase.type', 'sqlite');
        const dbHost = this.configService.get('dataDatabase.host', 'localhost');
        const redisHost = process.env.REDIS_HOST || this.configService.get('redis.host', 'localhost');
        const redisPort = parseInt(process.env.REDIS_PORT || '', 10) || this.configService.get('redis.port', 6379);
        const redisEnabled = process.env.REDIS_ENABLED === 'true';
        const queueEnabled = this.configService.get('queue.enabled', false);
        const redisConnected = await this.cacheService.isAvailable();
        const storageType = this.configService.get('storage.type', 'local');
        const storagePath = this.configService.get('storage.localPath', './data/media');
        const storageBucket = this.configService.get('storage.s3.bucket');
        const engineType = this.configService.get('engine.type', 'whatsapp-web.js');
        let webVersion;
        let webVersionSource;
        if (engineType === 'whatsapp-web.js') {
            if ((0, wa_web_version_1.getEffectiveWebVersionInfo)().source === 'auto') {
                void (0, wa_web_version_1.resolveCurrentWebVersion)().catch(() => undefined);
            }
            const info = (0, wa_web_version_1.getEffectiveWebVersionInfo)();
            webVersion = info.version;
            webVersionSource = info.source;
        }
        const engineHeadless = this.configService.get('engine.puppeteer.headless', true) ?? true;
        const sessionDataPath = this.configService.get('engine.sessionDataPath', './data/sessions');
        const browserArgs = this.configService.get('engine.puppeteer.args')?.join(' ') || '--no-sandbox --disable-gpu';
        const s3Endpoint = this.configService.get('storage.s3.endpoint');
        const running = this.dockerService.isDockerAvailable()
            ? await this.dockerService.getRunningBuiltinServices()
            : null;
        const savedBuiltin = this.readSavedBuiltinFlags();
        const dbBuiltIn = running ? running.database && dbHost === 'postgres' : savedBuiltin.database;
        const redisBuiltIn = running ? running.cache && redisHost === 'redis' : savedBuiltin.cache;
        const storageBuiltIn = running ? running.storage && s3Endpoint === 'http://minio:9000' : savedBuiltin.storage;
        const s3Available = storageType === 's3' ? await this.storageService.refreshS3Availability() : undefined;
        let webhooks = { pending: 0, completed: 0, failed: 0 };
        if (queueEnabled && this.webhookQueue) {
            try {
                const counts = await this.webhookQueue.getJobCounts('wait', 'active', 'delayed', 'completed', 'failed');
                webhooks = {
                    pending: (counts.wait ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0),
                    completed: counts.completed ?? 0,
                    failed: counts.failed ?? 0,
                };
            }
            catch (error) {
                this.logger.warn('Failed to read webhook queue job counts', { error: String(error) });
            }
        }
        return {
            database: { connected: dbConnected, type: dbType, host: dbHost, builtIn: dbBuiltIn },
            redis: {
                enabled: redisEnabled,
                connected: redisConnected,
                host: redisHost,
                port: redisPort,
                builtIn: redisBuiltIn,
            },
            queue: {
                enabled: queueEnabled,
                webhooks,
            },
            storage: {
                type: storageType,
                path: storagePath,
                ...(storageType === 's3' && storageBucket ? { bucket: storageBucket } : {}),
                builtIn: storageBuiltIn,
                ...(storageType === 's3' ? { s3Available } : {}),
            },
            engine: {
                type: engineType,
                headless: engineHeadless,
                sessionDataPath,
                browserArgs,
                ...(engineType === 'whatsapp-web.js' ? { webVersion, webVersionSource } : {}),
            },
        };
    }
    readSavedBuiltinFlags() {
        try {
            const envPath = path.resolve(process.cwd(), 'data', '.env.generated');
            const saved = fs.existsSync(envPath)
                ? dotenv.parse(fs.readFileSync(envPath, 'utf8'))
                : {};
            return {
                database: saved.POSTGRES_BUILTIN === 'true',
                cache: saved.REDIS_BUILTIN === 'true',
                storage: saved.MINIO_BUILTIN === 'true',
            };
        }
        catch {
            return { database: false, cache: false, storage: false };
        }
    }
    getEngines() {
        return this.engineFactory.getAvailableEngines();
    }
    getCurrentEngine() {
        return { engineType: this.engineFactory.getCurrentEngine() };
    }
    getConfig() {
        const envPath = path.resolve(process.cwd(), 'data', '.env.generated');
        const saved = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, 'utf8')) : {};
        return {
            database: {
                type: saved.DATABASE_TYPE === 'postgres' ? 'postgres' : 'sqlite',
                builtIn: saved.POSTGRES_BUILTIN === 'true',
                host: saved.DATABASE_HOST || '',
                port: saved.DATABASE_PORT || '',
                username: saved.DATABASE_USERNAME || '',
                database: saved.DATABASE_NAME || '',
                schema: saved.POSTGRES_SCHEMA || 'public',
                poolSize: Number(saved.DATABASE_POOL_SIZE) || 10,
                sslEnabled: saved.DATABASE_SSL === 'true',
                sslRejectUnauthorized: saved.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
                passwordSet: Boolean(saved.DATABASE_PASSWORD),
            },
            redis: {
                enabled: saved.REDIS_ENABLED === 'true',
                builtIn: saved.REDIS_BUILTIN === 'true',
                host: saved.REDIS_HOST || '',
                port: saved.REDIS_PORT || '',
                passwordSet: Boolean(saved.REDIS_PASSWORD),
            },
            queue: { enabled: saved.QUEUE_ENABLED === 'true' },
            storage: {
                type: saved.STORAGE_TYPE === 's3' ? 's3' : 'local',
                builtIn: saved.MINIO_BUILTIN === 'true',
                localPath: saved.STORAGE_LOCAL_PATH || '',
                s3Bucket: saved.S3_BUCKET || '',
                s3Region: saved.S3_REGION || '',
                s3Endpoint: saved.S3_ENDPOINT || '',
                s3CredentialsSet: Boolean(saved.S3_ACCESS_KEY_ID && saved.S3_SECRET_ACCESS_KEY),
            },
            engine: {
                type: saved.ENGINE_TYPE || 'whatsapp-web.js',
                headless: saved.PUPPETEER_HEADLESS !== 'false',
                sessionDataPath: saved.SESSION_DATA_PATH || '',
                browserArgs: saved.PUPPETEER_ARGS || '',
            },
        };
    }
    saveConfig(config) {
        try {
            const profiles = [];
            const envPath = path.resolve(process.cwd(), 'data', '.env.generated');
            const existing = fs.existsSync(envPath)
                ? dotenv.parse(fs.readFileSync(envPath, 'utf8'))
                : {};
            const updates = {};
            const staleKeys = new Set();
            const setSecret = (key, value) => {
                if (value)
                    updates[key] = value;
            };
            if (config.database) {
                updates.DATABASE_TYPE = config.database.type || 'sqlite';
                updates.POSTGRES_BUILTIN = config.database.builtIn ? 'true' : 'false';
                if (config.database.type === 'postgres') {
                    if (config.database.builtIn) {
                        updates.DATABASE_HOST = 'postgres';
                        updates.DATABASE_PORT = '5432';
                        updates.DATABASE_USERNAME = 'openwa';
                        updates.DATABASE_PASSWORD = 'openwa';
                        updates.DATABASE_NAME = 'openwa';
                        updates.POSTGRES_SCHEMA = 'public';
                        profiles.push('postgres');
                    }
                    else {
                        updates.DATABASE_HOST = config.database.host || 'localhost';
                        updates.DATABASE_PORT = config.database.port || '5432';
                        updates.DATABASE_USERNAME = config.database.username || 'postgres';
                        setSecret('DATABASE_PASSWORD', config.database.password);
                        updates.DATABASE_NAME = config.database.database || 'openwa';
                        updates.POSTGRES_SCHEMA = config.database.schema || 'public';
                    }
                    updates.DATABASE_POOL_SIZE = String(config.database.poolSize || 10);
                    updates.DATABASE_SSL = config.database.sslEnabled ? 'true' : 'false';
                    if (config.database.sslEnabled) {
                        updates.DATABASE_SSL_REJECT_UNAUTHORIZED =
                            config.database.sslRejectUnauthorized === false ? 'false' : 'true';
                    }
                }
                else {
                    for (const k of [
                        'DATABASE_HOST',
                        'DATABASE_PORT',
                        'DATABASE_USERNAME',
                        'DATABASE_PASSWORD',
                        'DATABASE_NAME',
                        'DATABASE_POOL_SIZE',
                        'DATABASE_SSL',
                        'DATABASE_SSL_REJECT_UNAUTHORIZED',
                        'POSTGRES_SCHEMA',
                    ]) {
                        staleKeys.add(k);
                    }
                }
            }
            if (config.redis || config.queue) {
                updates.REDIS_ENABLED = config.redis?.enabled ? 'true' : 'false';
                updates.REDIS_BUILTIN = config.redis?.builtIn ? 'true' : 'false';
                updates.QUEUE_ENABLED = config.queue?.enabled ? 'true' : 'false';
                if (config.redis?.enabled) {
                    if (config.redis.builtIn) {
                        updates.REDIS_HOST = 'redis';
                        updates.REDIS_PORT = '6379';
                        profiles.push('redis');
                    }
                    else {
                        updates.REDIS_HOST = config.redis.host || 'localhost';
                        updates.REDIS_PORT = config.redis.port || '6379';
                        setSecret('REDIS_PASSWORD', config.redis.password);
                    }
                }
            }
            if (config.storage) {
                updates.STORAGE_TYPE = config.storage.type || 'local';
                updates.MINIO_BUILTIN = config.storage.builtIn ? 'true' : 'false';
                if (config.storage.type === 'local') {
                    updates.STORAGE_LOCAL_PATH = config.storage.localPath || './data/media';
                    for (const k of ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_REGION']) {
                        staleKeys.add(k);
                    }
                }
                else if (config.storage.type === 's3') {
                    staleKeys.add('STORAGE_LOCAL_PATH');
                    if (config.storage.builtIn) {
                        updates.S3_ENDPOINT = 'http://minio:9000';
                        updates.S3_ACCESS_KEY_ID = 'minioadmin';
                        updates.S3_SECRET_ACCESS_KEY = 'minioadmin';
                        updates.S3_BUCKET = 'openwa';
                        updates.S3_REGION = 'us-east-1';
                        profiles.push('minio');
                    }
                    else {
                        updates.S3_BUCKET = config.storage.s3Bucket || '';
                        updates.S3_REGION = config.storage.s3Region || 'ap-southeast-1';
                        setSecret('S3_ACCESS_KEY_ID', config.storage.s3AccessKey);
                        setSecret('S3_SECRET_ACCESS_KEY', config.storage.s3SecretKey);
                        if (config.storage.s3Endpoint) {
                            updates.S3_ENDPOINT = config.storage.s3Endpoint;
                        }
                    }
                }
            }
            if (config.engine) {
                if (config.engine.type) {
                    const validEngineIds = this.engineFactory.getAvailableEngines().map(e => e.id);
                    if (!validEngineIds.includes(config.engine.type)) {
                        throw new common_1.BadRequestException(`Unknown engine type: ${config.engine.type}`);
                    }
                    updates.ENGINE_TYPE = config.engine.type;
                }
                updates.PUPPETEER_HEADLESS = config.engine.headless !== false ? 'true' : 'false';
                updates.SESSION_DATA_PATH = config.engine.sessionDataPath || './data/sessions';
                updates.PUPPETEER_ARGS = config.engine.browserArgs || '--no-sandbox --disable-gpu';
            }
            for (const [key, value] of Object.entries(updates)) {
                if (/[\r\n]/.test(value)) {
                    throw new common_1.BadRequestException(`Invalid configuration value for ${key}: line breaks are not allowed`);
                }
            }
            const merged = { ...existing, ...updates };
            for (const k of staleKeys) {
                delete merged[k];
            }
            const body = Object.keys(merged)
                .sort()
                .map(key => `${key}=${merged[key]}`);
            const contents = [
                '# OpenWA Configuration',
                `# Generated at ${new Date().toISOString()}`,
                '# Managed via Dashboard > Infrastructure. Values in process env or project .env take precedence.',
                '',
                ...body,
                '',
            ].join('\n');
            (0, secret_file_1.writeSecretFile)(envPath, contents);
            this.logger.log('Configuration saved', { envPath });
            const profileMsg = profiles.length > 0 ? ` Docker profiles required: ${profiles.join(', ')}.` : '';
            return {
                message: `Configuration saved successfully.${profileMsg} Server restart required to apply changes.`,
                saved: true,
                envPath: path.relative(process.cwd(), envPath),
                profiles,
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            return {
                message: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
                saved: false,
                envPath: '',
                profiles: [],
            };
        }
    }
    async requestRestart(body) {
        const profiles = body?.profiles || [];
        const profilesToRemove = body?.profilesToRemove || [];
        let orchestrationResult;
        let removalResult;
        this.logger.log('Restart requested', { profiles });
        this.logger.log('Profiles to remove', { profilesToRemove });
        if (this.dockerService.isDockerAvailable()) {
            const requested = profilesToRemove.filter(p => !profiles.includes(p));
            const toRemove = requested.filter(p => docker_1.MANAGED_DOCKER_PROFILES.includes(p));
            const ignored = requested.filter(p => !docker_1.MANAGED_DOCKER_PROFILES.includes(p));
            if (ignored.length > 0) {
                this.logger.warn('Ignoring non-managed profiles in profilesToRemove', { ignored });
            }
            if (toRemove.length > 0) {
                this.logger.log('Removing disabled profiles...', { toRemove });
                removalResult = { removed: [], errors: [] };
                for (const profile of toRemove) {
                    try {
                        const success = await this.dockerService.removeService(profile);
                        if (success) {
                            removalResult.removed.push(profile);
                        }
                        else {
                            removalResult.errors.push(`Failed to remove ${profile}`);
                        }
                    }
                    catch (err) {
                        removalResult.errors.push(`Error removing ${profile}: ${err}`);
                    }
                }
                this.logger.log('Removal result', { removalResult });
            }
            if (profiles.length > 0) {
                this.logger.log('Orchestrating enabled profiles...');
                orchestrationResult = await this.dockerService.orchestrateProfiles(profiles);
                this.logger.log('Orchestration result', { orchestrationResult });
            }
        }
        else {
            this.logger.warn('Docker not available, writing signal file instead');
            try {
                const signalFile = path.resolve(process.cwd(), 'data', '.orchestration-request.json');
                const orchestrationRequest = {
                    timestamp: new Date().toISOString(),
                    profiles,
                    profilesToRemove,
                    action: 'restart-with-profiles',
                };
                fs.writeFileSync(signalFile, JSON.stringify(orchestrationRequest, null, 2), 'utf8');
                this.logger.log('Orchestration request written', { signalFile });
            }
            catch (err) {
                this.logger.error('Failed to write orchestration request', err instanceof Error ? err.message : String(err));
            }
        }
        void this.shutdownService.shutdown();
        let estimatedTime = 15;
        if (profiles.includes('postgres'))
            estimatedTime += 20;
        if (profiles.includes('redis'))
            estimatedTime += 13;
        if (profiles.includes('minio'))
            estimatedTime += 15;
        if (profilesToRemove.length > 0)
            estimatedTime += profilesToRemove.length * 5;
        return {
            message: profiles.length > 0 || profilesToRemove.length > 0
                ? `Server is restarting. Enabling: ${profiles.join(', ') || 'none'}. Disabling: ${profilesToRemove.join(', ') || 'none'}.`
                : 'Server is restarting. Please wait...',
            restarting: true,
            profiles,
            profilesToRemove,
            estimatedTime,
            orchestration: orchestrationResult,
            removal: removalResult,
        };
    }
    healthCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }
    async exportData() {
        const sessions = await this.dataDataSource.query('SELECT * FROM sessions');
        const webhooks = await this.dataDataSource.query('SELECT * FROM webhooks');
        let messages = [];
        let messageBatches = [];
        let templates = [];
        let baileysStoredMessages = [];
        let lidMappings = [];
        try {
            messages = await this.dataDataSource.query('SELECT * FROM messages');
        }
        catch (error) {
            this.logger.debug('Messages table not available for export', { error: String(error) });
        }
        try {
            messageBatches = await this.dataDataSource.query('SELECT * FROM message_batches');
        }
        catch (error) {
            this.logger.debug('Message batches table not available for export', { error: String(error) });
        }
        try {
            templates = await this.dataDataSource.query('SELECT * FROM templates');
        }
        catch (error) {
            this.logger.debug('Templates table not available for export', { error: String(error) });
        }
        try {
            baileysStoredMessages = await this.dataDataSource.query('SELECT * FROM baileys_stored_messages');
        }
        catch (error) {
            this.logger.debug('Baileys stored messages table not available for export', { error: String(error) });
        }
        try {
            lidMappings = await this.dataDataSource.query('SELECT * FROM lid_mappings');
        }
        catch (error) {
            this.logger.debug('Lid mappings table not available for export', { error: String(error) });
        }
        return {
            exportedAt: new Date().toISOString(),
            dataDbType: this.configService.get('dataDatabase.type', 'sqlite'),
            tables: {
                sessions,
                webhooks,
                messages,
                messageBatches,
                templates,
                baileysStoredMessages,
                lidMappings,
            },
            counts: {
                sessions: sessions.length,
                webhooks: webhooks.length,
                messages: messages.length,
                messageBatches: messageBatches.length,
                templates: templates.length,
                baileysStoredMessages: baileysStoredMessages.length,
                lidMappings: lidMappings.length,
            },
        };
    }
    async importData(data) {
        const warnings = [];
        const queryRunner = this.dataDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const clearTable = async (table) => {
                try {
                    await queryRunner.query(`DELETE FROM ${table}`);
                }
                catch (err) {
                    if (!(0, db_errors_1.isMissingTableError)(err))
                        throw err;
                    this.logger.debug('Skipped clearing a table that does not exist during import', { table });
                }
            };
            await queryRunner.query('DELETE FROM webhooks');
            await clearTable('messages');
            await clearTable('message_batches');
            await clearTable('templates');
            await clearTable('baileys_stored_messages');
            await clearTable('lid_mappings');
            await queryRunner.query('DELETE FROM sessions');
            let sessionsCount = 0;
            if (data.tables.sessions?.length) {
                for (const session of data.tables.sessions) {
                    if (!(0, path_safety_1.isSafeSessionName)(session.name)) {
                        warnings.push(`Skipped session ${session.id}: unsafe name ${JSON.stringify(session.name)}`);
                        continue;
                    }
                    try {
                        await queryRunner.query(`INSERT INTO sessions (id, name, status, phone, "pushName", config, "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                            session.id,
                            session.name,
                            session.status,
                            session.phone,
                            session.pushName,
                            typeof session.config === 'string' ? session.config : JSON.stringify(session.config || {}),
                            session.proxyUrl,
                            session.proxyType,
                            session.connectedAt,
                            session.lastActiveAt,
                            session.createdAt,
                            session.updatedAt,
                        ]);
                        sessionsCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import session ${session.id}: ${err}`);
                    }
                }
            }
            let webhooksCount = 0;
            if (data.tables.webhooks?.length) {
                for (const webhook of data.tables.webhooks) {
                    try {
                        await queryRunner.query(`INSERT INTO webhooks (id, "sessionId", url, events, secret, headers, filters, active, "retryCount", "lastTriggeredAt", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                            webhook.id,
                            webhook.sessionId,
                            webhook.url,
                            typeof webhook.events === 'string' ? webhook.events : JSON.stringify(webhook.events || []),
                            webhook.secret,
                            typeof webhook.headers === 'string' ? webhook.headers : JSON.stringify(webhook.headers || {}),
                            webhook.filters == null
                                ? null
                                : typeof webhook.filters === 'string'
                                    ? webhook.filters
                                    : JSON.stringify(webhook.filters),
                            webhook.active,
                            webhook.retryCount,
                            webhook.lastTriggeredAt,
                            webhook.createdAt,
                            webhook.updatedAt,
                        ]);
                        webhooksCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import webhook ${webhook.id}: ${err}`);
                    }
                }
            }
            let messagesCount = 0;
            if (data.tables.messages?.length) {
                for (const msg of data.tables.messages) {
                    try {
                        await queryRunner.query(`INSERT INTO messages (id, "sessionId", "waMessageId", "chatId", "from", "to", body, type, direction, "timestamp", metadata, status, "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [
                            msg.id,
                            msg.sessionId,
                            msg.waMessageId ?? null,
                            msg.chatId,
                            msg.from,
                            msg.to,
                            msg.body ?? null,
                            msg.type,
                            msg.direction,
                            msg.timestamp ?? null,
                            msg.metadata == null
                                ? null
                                : typeof msg.metadata === 'string'
                                    ? msg.metadata
                                    : JSON.stringify(msg.metadata),
                            msg.status,
                            msg.createdAt,
                        ]);
                        messagesCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import message ${msg.id}: ${err}`);
                    }
                }
            }
            let messageBatchesCount = 0;
            if (data.tables.messageBatches?.length) {
                for (const batch of data.tables.messageBatches) {
                    try {
                        await queryRunner.query(`INSERT INTO message_batches (id, batch_id, session_id, status, messages, options, progress, results, current_index, created_at, updated_at, started_at, completed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [
                            batch.id,
                            batch.batch_id,
                            batch.session_id,
                            batch.status,
                            typeof batch.messages === 'string' ? batch.messages : JSON.stringify(batch.messages ?? []),
                            batch.options == null
                                ? null
                                : typeof batch.options === 'string'
                                    ? batch.options
                                    : JSON.stringify(batch.options),
                            batch.progress == null
                                ? null
                                : typeof batch.progress === 'string'
                                    ? batch.progress
                                    : JSON.stringify(batch.progress),
                            batch.results == null
                                ? null
                                : typeof batch.results === 'string'
                                    ? batch.results
                                    : JSON.stringify(batch.results),
                            batch.current_index,
                            batch.created_at,
                            batch.updated_at,
                            batch.started_at,
                            batch.completed_at,
                        ]);
                        messageBatchesCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import message batch ${batch.id}: ${err}`);
                    }
                }
            }
            let templatesCount = 0;
            if (data.tables.templates?.length) {
                for (const tpl of data.tables.templates) {
                    try {
                        await queryRunner.query(`INSERT INTO templates (id, "sessionId", name, body, header, footer, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                            tpl.id,
                            tpl.sessionId,
                            tpl.name,
                            tpl.body,
                            tpl.header ?? null,
                            tpl.footer ?? null,
                            tpl.createdAt,
                            tpl.updatedAt,
                        ]);
                        templatesCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import template ${tpl.id}: ${err}`);
                    }
                }
            }
            let baileysStoredMessagesCount = 0;
            if (data.tables.baileysStoredMessages?.length) {
                for (const bsm of data.tables.baileysStoredMessages) {
                    try {
                        await queryRunner.query(`INSERT INTO baileys_stored_messages (id, "sessionId", "waMessageId", "serializedMessage", "createdAt")
               VALUES ($1, $2, $3, $4, $5)`, [bsm.id, bsm.sessionId, bsm.waMessageId, bsm.serializedMessage, bsm.createdAt]);
                        baileysStoredMessagesCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import baileys stored message ${bsm.id}: ${err}`);
                    }
                }
            }
            let lidMappingsCount = 0;
            if (data.tables.lidMappings?.length) {
                for (const lm of data.tables.lidMappings) {
                    try {
                        await queryRunner.query(`INSERT INTO lid_mappings (lid, phone, "sessionId", "updatedAt") VALUES ($1, $2, $3, $4)`, [lm.lid, lm.phone ?? null, lm.sessionId ?? null, lm.updatedAt]);
                        lidMappingsCount++;
                    }
                    catch (err) {
                        warnings.push(`Failed to import lid mapping ${lm.lid}: ${err}`);
                    }
                }
            }
            const counts = {
                sessions: sessionsCount,
                webhooks: webhooksCount,
                messages: messagesCount,
                messageBatches: messageBatchesCount,
                templates: templatesCount,
                baileysStoredMessages: baileysStoredMessagesCount,
                lidMappings: lidMappingsCount,
            };
            if (warnings.length > 0) {
                await queryRunner.rollbackTransaction();
                return { imported: false, counts, warnings };
            }
            const totalRestored = Object.values(counts).reduce((sum, n) => sum + n, 0);
            if (totalRestored === 0) {
                await queryRunner.rollbackTransaction();
                return {
                    imported: false,
                    counts,
                    warnings: ['Backup contained no rows to restore; refused to replace existing data. Check the file.'],
                };
            }
            await queryRunner.commitTransaction();
            return { imported: true, counts, warnings };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getStorageFileCount() {
        const { count, sizeBytes } = await this.storageService.getFileCount();
        return {
            storageType: this.storageService.getCurrentStorageType(),
            count,
            sizeBytes,
            sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
        };
    }
    async exportStorage() {
        const stream = await this.storageService.createExportStream();
        const exportDir = path.join(process.cwd(), 'data', 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const exportPath = path.join(exportDir, `storage-export-${Date.now()}-${(0, crypto_1.randomUUID)()}.tar.gz`);
        const writeStream = fs.createWriteStream(exportPath);
        stream.pipe(writeStream);
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
        const ttlRaw = Number.parseInt(process.env.STORAGE_EXPORT_TTL_MS ?? '', 10);
        const ttlMs = Number.isInteger(ttlRaw) && ttlRaw > 0 ? ttlRaw : 60 * 60 * 1000;
        setTimeout(() => {
            fs.promises.unlink(exportPath).catch(() => undefined);
        }, ttlMs).unref();
        return {
            message: 'Storage export completed',
            download: path.relative(process.cwd(), exportPath),
        };
    }
    async importStorage(body) {
        const { filePath } = body;
        const dataDir = path.join(process.cwd(), 'data');
        if (!filePath || !(0, path_safety_1.isPathWithin)(dataDir, filePath)) {
            throw new common_1.BadRequestException('filePath must reference a file inside the data directory');
        }
        if (!fs.existsSync(filePath)) {
            throw new common_1.BadRequestException(`File not found: ${filePath}`);
        }
        const readStream = fs.createReadStream(filePath);
        const count = await this.storageService.importFromStream(readStream);
        return {
            imported: true,
            count,
            storageType: this.storageService.getCurrentStorageType(),
        };
    }
};
exports.InfraController = InfraController;
__decorate([
    (0, common_1.Get)('status'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get infrastructure status' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Infrastructure status' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('engines'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get available WhatsApp engines' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of available engines' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], InfraController.prototype, "getEngines", null);
__decorate([
    (0, common_1.Get)('engines/current'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get current active engine' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Current engine info' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], InfraController.prototype, "getCurrentEngine", null);
__decorate([
    (0, common_1.Get)('config'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Read the saved infrastructure configuration for the dashboard form' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Saved configuration (secrets omitted)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], InfraController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)('config'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Save infrastructure configuration to .env file' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Configuration saved' }),
    (0, swagger_1.ApiBody)({ description: 'Configuration to save' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], InfraController.prototype, "saveConfig", null);
__decorate([
    (0, common_1.Post)('restart'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Request server restart with Docker orchestration' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Server will restart with new profiles' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "requestRestart", null);
__decorate([
    (0, common_1.Get)('health'),
    (0, auth_decorators_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Health check endpoint' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Server is healthy' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], InfraController.prototype, "healthCheck", null);
__decorate([
    (0, common_1.Get)('export-data'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Export all data from Data DB for migration' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Exported data as JSON' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "exportData", null);
__decorate([
    (0, common_1.Post)('import-data'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Import data to Data DB (replaces existing data)' }),
    (0, swagger_1.ApiBody)({
        description: 'Exported data from export-data endpoint',
        schema: {
            type: 'object',
            properties: {
                tables: {
                    type: 'object',
                    properties: {
                        sessions: { type: 'array' },
                        webhooks: { type: 'array' },
                        messages: { type: 'array' },
                        messageBatches: { type: 'array' },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Data imported successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "importData", null);
__decorate([
    (0, common_1.Get)('storage/files/count'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Get file count in current storage' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'File count and size' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "getStorageFileCount", null);
__decorate([
    (0, common_1.Get)('storage/export'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Export all storage files as tar.gz' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tar.gz archive stream' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "exportStorage", null);
__decorate([
    (0, common_1.Post)('storage/import'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Import storage files from tar.gz' }),
    (0, swagger_1.ApiBody)({ description: 'Path to tar.gz file to import' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Import result' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [import_storage_dto_1.ImportStorageDto]),
    __metadata("design:returntype", Promise)
], InfraController.prototype, "importStorage", null);
exports.InfraController = InfraController = InfraController_1 = __decorate([
    (0, swagger_1.ApiTags)('infrastructure'),
    (0, common_1.Controller)('infra'),
    __param(1, (0, typeorm_2.InjectDataSource)('main')),
    __param(2, (0, typeorm_2.InjectDataSource)('data')),
    __param(8, (0, common_1.Optional)()),
    __param(8, (0, bullmq_1.InjectQueue)(queue_names_1.QUEUE_NAMES.WEBHOOK)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_1.DataSource,
        typeorm_1.DataSource,
        engine_factory_1.EngineFactory,
        docker_1.DockerService,
        cache_service_1.CacheService,
        storage_service_1.StorageService,
        shutdown_service_1.ShutdownService,
        bullmq_2.Queue])
], InfraController);
//# sourceMappingURL=infra.controller.js.map