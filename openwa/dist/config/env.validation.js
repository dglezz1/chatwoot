"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const path_1 = require("path");
const MAIN_DB_PATH = './data/main.sqlite';
function validateEnv(config) {
    const errors = [];
    const str = (key) => {
        const value = config[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
    };
    const dbType = str('DATABASE_TYPE');
    if (dbType && dbType !== 'sqlite' && dbType !== 'postgres') {
        errors.push(`DATABASE_TYPE must be "sqlite" or "postgres" (got "${dbType}")`);
    }
    const checkEnum = (key, allowed) => {
        const value = str(key);
        if (value !== undefined && !allowed.includes(value)) {
            errors.push(`${key} must be one of ${allowed.map(v => `"${v}"`).join(', ')} (got "${value}")`);
        }
    };
    checkEnum('ENGINE_TYPE', ['whatsapp-web.js', 'baileys']);
    checkEnum('STORAGE_TYPE', ['local', 's3']);
    if (dbType === 'postgres') {
        for (const key of ['DATABASE_HOST', 'DATABASE_USERNAME', 'DATABASE_PASSWORD']) {
            if (!str(key)) {
                errors.push(`${key} is required when DATABASE_TYPE=postgres`);
            }
        }
        const pgSchema = str('POSTGRES_SCHEMA');
        if (pgSchema !== undefined) {
            if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(pgSchema)) {
                errors.push(`POSTGRES_SCHEMA must be a valid Postgres identifier (a letter or underscore, then letters/digits/underscores, max 63 chars; got ${JSON.stringify(pgSchema)})`);
            }
            else if (pgSchema.toLowerCase().startsWith('pg_')) {
                errors.push(`POSTGRES_SCHEMA must not use the reserved "pg_" prefix (got ${JSON.stringify(pgSchema)})`);
            }
        }
    }
    else {
        const dataDbName = str('DATABASE_NAME');
        if (dataDbName && (0, path_1.resolve)(dataDbName) === (0, path_1.resolve)(MAIN_DB_PATH)) {
            errors.push(`DATABASE_NAME must not point at the main database file (${MAIN_DB_PATH}); use a separate file`);
        }
    }
    const checkPort = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
            errors.push(`${key} must be an integer port in [1, 65535] (got "${raw}")`);
        }
    };
    checkPort('PORT');
    checkPort('DATABASE_PORT');
    checkPort('REDIS_PORT');
    const checkNonNegativeInt = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) {
            errors.push(`${key} must be a non-negative integer (got "${raw}")`);
        }
    };
    for (const key of [
        'RATE_LIMIT_SHORT_TTL',
        'RATE_LIMIT_MEDIUM_TTL',
        'RATE_LIMIT_LONG_TTL',
        'WEBHOOK_MAX_RETRIES',
        'WEBHOOK_RETRY_DELAY',
        'DATABASE_POOL_SIZE',
        'DATABASE_STATEMENT_TIMEOUT_MS',
        'DATABASE_IDLE_TIMEOUT_MS',
        'DATABASE_CONNECTION_TIMEOUT_MS',
        'REDIS_CONNECT_TIMEOUT_MS',
        'MAX_CONCURRENT_SESSIONS',
        'INGRESS_INSTANCE_TTL',
    ]) {
        checkNonNegativeInt(key);
    }
    const checkPositiveInt = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) {
            errors.push(`${key} must be a positive integer (got "${raw}")`);
        }
    };
    for (const key of [
        'RATE_LIMIT_SHORT_LIMIT',
        'RATE_LIMIT_MEDIUM_LIMIT',
        'RATE_LIMIT_LONG_LIMIT',
        'WEBHOOK_TIMEOUT',
        'INGRESS_INSTANCE_LIMIT',
    ]) {
        checkPositiveInt(key);
    }
    const checkBool = (key) => {
        const raw = config[key];
        if (raw === undefined)
            return;
        if (typeof raw !== 'string') {
            errors.push(`${key} must be "true" or "false"`);
            return;
        }
        if (raw.trim() === '')
            return;
        if (raw !== 'true' && raw !== 'false') {
            errors.push(`${key} must be "true" or "false" (got ${JSON.stringify(raw)})`);
        }
    };
    for (const key of [
        'QUEUE_ENABLED',
        'MCP_ENABLED',
        'SERVE_DASHBOARD',
        'AUTO_START_SESSIONS',
        'STORE_EPHEMERAL_MESSAGES',
        'RESOLVE_LID_TO_PHONE',
        'SIMULATE_TYPING',
        'SEARCH_ENABLED',
    ]) {
        checkBool(key);
    }
    const provider = config['SEARCH_PROVIDER'];
    if (provider !== undefined && provider !== '' && !['auto', 'builtin-fts', 'none'].includes(provider)) {
        errors.push(`SEARCH_PROVIDER must be one of: auto, builtin-fts, none (got ${JSON.stringify(provider)})`);
    }
    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
    }
    return config;
}
//# sourceMappingURL=env.validation.js.map