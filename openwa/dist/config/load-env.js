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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvironment = loadEnvironment;
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const secret_file_1 = require("../common/utils/secret-file");
const env_precedence_1 = require("./env-precedence");
function loadEnvironment() {
    const generatedEnvPath = path.resolve(process.cwd(), 'data', '.env.generated');
    const userEnvPath = path.resolve(process.cwd(), '.env');
    const dataDir = path.dirname(generatedEnvPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    for (const secret of [generatedEnvPath, path.resolve(dataDir, '.api-key')]) {
        if (fs.existsSync(secret)) {
            try {
                fs.chmodSync(secret, 0o600);
            }
            catch {
            }
        }
    }
    (0, env_precedence_1.clearBlankEnv)(process.env, env_precedence_1.BLANK_SHADOWED_ENV_KEYS);
    if (fs.existsSync(userEnvPath)) {
        console.log('[Bootstrap] Loading .env from:', userEnvPath);
        dotenv.config({ path: userEnvPath, override: false });
    }
    if (fs.existsSync(generatedEnvPath)) {
        console.log('[Bootstrap] Loading saved configuration from:', generatedEnvPath);
        dotenv.config({ path: generatedEnvPath, override: false });
    }
    else {
        console.log('[Bootstrap] First run detected, creating default configuration...');
        const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_LOCAL_PATH=./data/media

# Docker Profiles: none (minimal setup)
`;
        (0, secret_file_1.writeSecretFile)(generatedEnvPath, minimalConfig);
        console.log('[Bootstrap] Created default configuration at:', generatedEnvPath);
        dotenv.config({ path: generatedEnvPath, override: false });
    }
}
loadEnvironment();
//# sourceMappingURL=load-env.js.map