"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/load-env");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const shutdown_service_1 = require("./common/services/shutdown.service");
const logger_service_1 = require("./common/services/logger.service");
const swagger_config_1 = require("./config/swagger.config");
const process_error_monitor_1 = require("./config/process-error-monitor");
const bootstrap_security_1 = require("./config/bootstrap-security");
const bull_board_auth_middleware_1 = require("./common/security/bull-board-auth.middleware");
const auth_service_1 = require("./modules/auth/auth.service");
const express_1 = require("express");
async function bootstrap() {
    const requestedLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
    if (requestedLevel && Object.values(logger_service_1.LogLevel).includes(requestedLevel)) {
        logger_service_1.LoggerService.setLogLevel(requestedLevel);
    }
    const bootstrapLogger = (0, logger_service_1.createLogger)('Bootstrap');
    process.on('unhandledRejection', (reason) => {
        bootstrapLogger.error('Unhandled promise rejection', reason instanceof Error ? reason.stack : String(reason));
    });
    (0, process_error_monitor_1.registerUncaughtExceptionMonitor)(bootstrapLogger);
    (0, bootstrap_security_1.assertNoDefaultSecretsInProduction)({
        nodeEnv: process.env.NODE_ENV,
        databaseType: process.env.DATABASE_TYPE,
        databasePassword: process.env.DATABASE_PASSWORD,
        postgresBuiltIn: process.env.POSTGRES_BUILTIN,
        databaseHost: process.env.DATABASE_HOST,
        storageType: process.env.STORAGE_TYPE,
        minioBuiltIn: process.env.MINIO_BUILTIN,
        s3Endpoint: process.env.S3_ENDPOINT,
        s3AccessKey: process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY,
        s3SecretKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY,
        apiMasterKey: process.env.API_MASTER_KEY,
        allowDevApiKey: process.env.ALLOW_DEV_API_KEY,
        redisPassword: process.env.REDIS_PASSWORD,
    });
    if ((0, bootstrap_security_1.isApiKeyPepperMissingInProduction)(process.env.NODE_ENV, process.env.API_KEY_PEPPER)) {
        bootstrapLogger.warn('API_KEY_PEPPER is not set in production: stored API-key hashes use plain SHA-256. ' +
            'Set API_KEY_PEPPER and re-issue keys to enable HMAC hashing.');
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    const bodyLimit = (0, bootstrap_security_1.resolveBodyLimit)(process.env.BODY_SIZE_LIMIT);
    app.use((0, express_1.json)({
        limit: bodyLimit,
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: bodyLimit }));
    app.enableShutdownHooks(Object.values(common_1.ShutdownSignal).filter(s => s !== common_1.ShutdownSignal.SIGTERM && s !== common_1.ShutdownSignal.SIGINT));
    const shutdownService = app.get(shutdown_service_1.ShutdownService);
    shutdownService.setShutdownCallback(async () => {
        await app.close();
    });
    let signalReceived = false;
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => {
            if (signalReceived) {
                process.exit(130);
            }
            signalReceived = true;
            shutdownService.shutdown();
        });
    }
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: (0, bootstrap_security_1.isUpgradeInsecureRequestsEnabled)(process.env.CSP_UPGRADE_INSECURE_REQUESTS, process.env.NODE_ENV)
                    ? []
                    : null,
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    const corsPolicy = (0, bootstrap_security_1.resolveCorsPolicy)(process.env.CORS_ORIGINS, process.env.NODE_ENV);
    if (process.env.NODE_ENV === 'production' && corsPolicy.origins.length === 0 && !corsPolicy.allowAnyOrigin) {
        console.warn('[Bootstrap] No explicit CORS_ORIGINS in production (wildcard "*" is refused): cross-origin browser ' +
            'requests will be blocked. Set CORS_ORIGINS to your dashboard origin(s).');
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (corsPolicy.allowAnyOrigin || corsPolicy.origins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(null, false);
            }
        },
        credentials: corsPolicy.credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Request-ID'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        maxAge: 86400,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
        disableErrorMessages: !(0, bootstrap_security_1.isValidationErrorDetailEnabled)(process.env.VALIDATION_ERROR_DETAIL, process.env.NODE_ENV),
    }));
    const swaggerEnabled = (0, bootstrap_security_1.isSwaggerEnabled)(process.env.ENABLE_SWAGGER, process.env.NODE_ENV);
    if (swaggerEnabled) {
        const config = (0, swagger_config_1.createSwaggerConfig)();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        (0, swagger_config_1.exemptPublicOperations)(document);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    const bullBoardAuth = new bull_board_auth_middleware_1.BullBoardAuthMiddleware(app.get(auth_service_1.AuthService), app.get(config_1.ConfigService));
    app.use('/api/admin/queues', (req, res, next) => {
        void bullBoardAuth.use(req, res, next);
    });
    const port = process.env.PORT || 2785;
    await app.listen(port);
    console.log(`🚀 OpenWA is running on: http://localhost:${port}`);
    if (swaggerEnabled) {
        console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
    }
    if (!app_module_1.dashboardServingEnabled) {
        console.log('🖥️  Dashboard: serving disabled (SERVE_DASHBOARD=false); API only');
    }
    else if (app_module_1.dashboardBuildPresent) {
        console.log(`🖥️  Dashboard: serving bundled UI at http://localhost:${port}`);
    }
    else {
        console.warn(`⚠️  Dashboard: no build at ${app_module_1.DASHBOARD_DIST} - UI disabled (API still serves /api). ` +
            'Run `npm run build:all` to bundle it, or use the Vite dev server (`npm run dev`).');
    }
}
void bootstrap();
//# sourceMappingURL=main.js.map