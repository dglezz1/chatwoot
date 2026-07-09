"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCorsPolicy = resolveCorsPolicy;
exports.isSwaggerEnabled = isSwaggerEnabled;
exports.isValidationErrorDetailEnabled = isValidationErrorDetailEnabled;
exports.isUpgradeInsecureRequestsEnabled = isUpgradeInsecureRequestsEnabled;
exports.resolveBodyLimit = resolveBodyLimit;
exports.isApiKeyPepperMissingInProduction = isApiKeyPepperMissingInProduction;
exports.assertNoDefaultSecretsInProduction = assertNoDefaultSecretsInProduction;
function resolveCorsPolicy(corsOriginsEnv, nodeEnv) {
    const origins = corsOriginsEnv
        ?.split(',')
        .map(o => o.trim())
        .filter(Boolean) ?? ['*'];
    const hasWildcard = origins.includes('*');
    if (hasWildcard && nodeEnv === 'production') {
        return { origins: [], allowAnyOrigin: false, credentials: false };
    }
    return {
        origins,
        allowAnyOrigin: hasWildcard,
        credentials: !hasWildcard,
    };
}
function isSwaggerEnabled(enableSwaggerEnv, nodeEnv) {
    if (enableSwaggerEnv === 'true')
        return true;
    if (enableSwaggerEnv === 'false')
        return false;
    return nodeEnv !== 'production';
}
function isValidationErrorDetailEnabled(validationDetailEnv, nodeEnv) {
    if (validationDetailEnv === 'true')
        return true;
    if (validationDetailEnv === 'false')
        return false;
    return nodeEnv !== 'production';
}
function isUpgradeInsecureRequestsEnabled(cspEnv, nodeEnv) {
    if (cspEnv === 'true')
        return true;
    if (cspEnv === 'false')
        return false;
    return nodeEnv === 'production';
}
const BODY_LIMIT_PATTERN = /^\d+(\.\d+)?\s?(b|kb|mb|gb|tb|pb)?$/i;
function resolveBodyLimit(bodySizeEnv) {
    const trimmed = bodySizeEnv?.trim();
    return trimmed && BODY_LIMIT_PATTERN.test(trimmed) ? trimmed : '25mb';
}
const FORBIDDEN_PROD_SECRETS = new Set([
    'openwa',
    'minioadmin',
    'your-secure-password',
    'dev-master-key',
    'dev-admin-key',
    'changeme',
    'change-me',
    'password',
    'secret',
    'admin',
    '123456',
    'qwerty',
    'root',
    'test',
    'demo',
]);
function isApiKeyPepperMissingInProduction(nodeEnv, apiKeyPepper) {
    return nodeEnv === 'production' && !apiKeyPepper?.trim();
}
function isInternalS3Endpoint(endpoint) {
    const e = endpoint?.trim();
    if (!e)
        return true;
    try {
        return new URL(e).hostname === 'minio';
    }
    catch {
        return false;
    }
}
function assertNoDefaultSecretsInProduction(env) {
    if (env.nodeEnv !== 'production')
        return;
    const isWeak = (value) => !value || FORBIDDEN_PROD_SECRETS.has(value.trim().toLowerCase());
    const problems = [];
    const dbHost = env.databaseHost?.trim();
    const dbExempt = env.postgresBuiltIn === 'true' && (!dbHost || dbHost === 'postgres');
    if (env.databaseType === 'postgres' && !dbExempt && isWeak(env.databasePassword)) {
        problems.push('DATABASE_PASSWORD');
    }
    const s3Exempt = env.minioBuiltIn === 'true' && isInternalS3Endpoint(env.s3Endpoint);
    if (env.storageType === 's3' && !s3Exempt) {
        if (isWeak(env.s3AccessKey))
            problems.push('S3_ACCESS_KEY');
        if (isWeak(env.s3SecretKey))
            problems.push('S3_SECRET_KEY');
    }
    if (env.apiMasterKey && FORBIDDEN_PROD_SECRETS.has(env.apiMasterKey.trim().toLowerCase())) {
        problems.push('API_MASTER_KEY');
    }
    if (env.redisPassword && FORBIDDEN_PROD_SECRETS.has(env.redisPassword.trim().toLowerCase())) {
        problems.push('REDIS_PASSWORD');
    }
    if (env.allowDevApiKey === 'true') {
        problems.push('ALLOW_DEV_API_KEY (seeds the public dev-admin-key)');
    }
    if (problems.length > 0) {
        throw new Error(`Refusing to start in production: insecure or default value for ${problems.join(', ')}. ` +
            'Set strong, unique secrets (see .env.example).');
    }
}
//# sourceMappingURL=bootstrap-security.js.map