"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const feature_flags_1 = require("./feature-flags");
exports.default = () => ({
    port: parseInt(process.env.PORT || '2785', 10),
    search: {
        enabled: process.env.SEARCH_ENABLED !== 'false',
        provider: process.env.SEARCH_PROVIDER || 'auto',
        limitMax: Number(process.env.SEARCH_LIMIT_MAX) || 100,
    },
    features: (0, feature_flags_1.computeFeatureFlags)(),
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10),
    },
    queue: {
        enabled: process.env.QUEUE_ENABLED === 'true',
    },
    cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
    },
    database: {
        type: 'sqlite',
        database: process.env.MAIN_DATABASE_NAME || './data/main.sqlite',
        synchronize: process.env.MAIN_DATABASE_SYNCHRONIZE !== 'false',
        logging: process.env.DATABASE_LOGGING === 'true',
    },
    dataDatabase: {
        type: process.env.DATABASE_TYPE || 'sqlite',
        database: process.env.DATABASE_NAME || './data/openwa.sqlite',
        name: process.env.DATABASE_NAME || 'openwa',
        schema: process.env.POSTGRES_SCHEMA || 'public',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432', 10),
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
        logging: process.env.DATABASE_LOGGING === 'true',
        poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
        statementTimeoutMs: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT_MS || '30000', 10),
        idleTimeoutMs: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10),
        connectionTimeoutMs: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000', 10),
        ssl: process.env.DATABASE_SSL === 'true',
        sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
    engine: {
        type: process.env.ENGINE_TYPE || 'whatsapp-web.js',
        puppeteer: {
            headless: process.env.PUPPETEER_HEADLESS !== 'false',
            args: (process.env.PUPPETEER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(/[\s,]+/).filter(Boolean),
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        },
        sessionDataPath: process.env.SESSION_DATA_PATH || './data/sessions',
        baileys: {
            authDir: process.env.BAILEYS_AUTH_DIR || './data/baileys',
        },
    },
    sessions: {
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '0', 10),
    },
    webhook: {
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
        maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10),
    },
    api: {
        rateLimit: {
            shortTtl: parseInt(process.env.RATE_LIMIT_SHORT_TTL || '1000', 10),
            shortLimit: parseInt(process.env.RATE_LIMIT_SHORT_LIMIT || '10', 10),
            mediumTtl: parseInt(process.env.RATE_LIMIT_MEDIUM_TTL || '60000', 10),
            mediumLimit: parseInt(process.env.RATE_LIMIT_MEDIUM_LIMIT || '100', 10),
            longTtl: parseInt(process.env.RATE_LIMIT_LONG_TTL || '3600000', 10),
            longLimit: parseInt(process.env.RATE_LIMIT_LONG_LIMIT || '1000', 10),
        },
    },
    security: {
        trustedProxies: (process.env.TRUSTED_PROXIES || '')
            .split(',')
            .map(proxy => proxy.trim())
            .filter(Boolean),
    },
    plugins: {
        dir: process.env.PLUGINS_DIR || './plugins',
        catalogUrl: process.env.PLUGIN_CATALOG_URL || 'https://raw.githubusercontent.com/rmyndharis/OpenWA-plugins/main/plugins.json',
        downloadMaxBytes: (() => {
            const n = parseInt(process.env.PLUGIN_DOWNLOAD_MAX_BYTES ?? '', 10);
            return Number.isFinite(n) && n > 0 ? n : 5 * 1024 * 1024;
        })(),
    },
    storage: {
        type: process.env.STORAGE_TYPE || 'local',
        localPath: process.env.STORAGE_LOCAL_PATH || './data/media',
        s3: {
            bucket: process.env.S3_BUCKET,
            region: process.env.S3_REGION,
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            endpoint: process.env.S3_ENDPOINT,
        },
    },
});
//# sourceMappingURL=configuration.js.map