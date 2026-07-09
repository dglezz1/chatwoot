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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginStorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_service_1 = require("../../common/services/logger.service");
const path_safety_1 = require("../../common/utils/path-safety");
let tmpWriteSeq = 0;
function atomicWriteFileSync(filePath, data, options) {
    const tmp = `${filePath}.${process.pid}.${tmpWriteSeq++}.tmp`;
    try {
        fs.writeFileSync(tmp, data, options);
        fs.renameSync(tmp, filePath);
    }
    catch (err) {
        try {
            fs.rmSync(tmp, { force: true });
        }
        catch {
        }
        throw err;
    }
}
const ENCODED_KEY_PREFIX = 'key-';
function encodeStorageKey(key) {
    return (ENCODED_KEY_PREFIX +
        Buffer.from(key, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''));
}
function decodeStorageFileName(stem) {
    if (!stem.startsWith(ENCODED_KEY_PREFIX))
        return null;
    const encoded = stem.slice(ENCODED_KEY_PREFIX.length);
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4);
    try {
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        return encodeStorageKey(decoded) === stem ? decoded : null;
    }
    catch {
        return null;
    }
}
let PluginStorageService = class PluginStorageService {
    configService;
    logger = (0, logger_service_1.createLogger)('PluginStorageService');
    dataDir;
    registryPath;
    registry = new Map();
    constructor(configService) {
        this.configService = configService;
        this.dataDir = this.configService.get('dataDir') ?? './data';
        this.registryPath = path.join(this.dataDir, 'plugins', 'registry.json');
        this.loadRegistry();
    }
    loadRegistry() {
        try {
            if (fs.existsSync(this.registryPath)) {
                const content = fs.readFileSync(this.registryPath, 'utf-8');
                const entries = JSON.parse(content);
                this.registry = new Map(entries.map(e => [e.id, e]));
                this.logger.debug(`Loaded ${this.registry.size} plugins from registry`, {
                    action: 'registry_loaded',
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to load plugin registry', String(error), {
                action: 'registry_load_failed',
            });
        }
    }
    saveRegistry() {
        try {
            const dir = path.dirname(this.registryPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            }
            const entries = Array.from(this.registry.values());
            atomicWriteFileSync(this.registryPath, JSON.stringify(entries, null, 2), { mode: 0o600 });
            try {
                fs.chmodSync(this.registryPath, 0o600);
            }
            catch {
            }
        }
        catch (error) {
            this.logger.error('Failed to save plugin registry', String(error), {
                action: 'registry_save_failed',
            });
        }
    }
    getPluginEntry(pluginId) {
        return this.registry.get(pluginId);
    }
    setPluginEntry(entry) {
        entry.updatedAt = new Date();
        this.registry.set(entry.id, entry);
        this.saveRegistry();
    }
    deletePluginEntry(pluginId) {
        this.registry.delete(pluginId);
        this.saveRegistry();
    }
    getAllEntries() {
        return Array.from(this.registry.values());
    }
    getPluginStatus(pluginId) {
        const entry = this.registry.get(pluginId);
        return entry?.status ?? null;
    }
    setPluginStatus(pluginId, status) {
        const entry = this.registry.get(pluginId);
        if (entry) {
            entry.status = status;
            entry.updatedAt = new Date();
            this.saveRegistry();
        }
    }
    getPluginConfig(pluginId) {
        const entry = this.registry.get(pluginId);
        return entry?.config ?? null;
    }
    setPluginConfig(pluginId, config) {
        const entry = this.registry.get(pluginId);
        if (entry) {
            entry.config = config;
            entry.updatedAt = new Date();
            this.saveRegistry();
        }
    }
    getPluginSessions(pluginId) {
        const entry = this.registry.get(pluginId);
        return entry?.activeSessions ?? null;
    }
    setPluginSessions(pluginId, sessions) {
        const entry = this.registry.get(pluginId);
        if (entry) {
            entry.activeSessions = sessions;
            entry.updatedAt = new Date();
            this.saveRegistry();
        }
    }
    getPluginSessionConfig(pluginId) {
        const entry = this.registry.get(pluginId);
        return entry?.sessionConfig ?? null;
    }
    setPluginSessionConfig(pluginId, sessionConfig) {
        const entry = this.registry.get(pluginId);
        if (entry) {
            entry.sessionConfig = sessionConfig;
            entry.updatedAt = new Date();
            this.saveRegistry();
        }
    }
    createPluginStorage(pluginId) {
        const pluginDataDir = path.join(this.dataDir, 'plugins', pluginId);
        if (!fs.existsSync(pluginDataDir)) {
            fs.mkdirSync(pluginDataDir, { recursive: true, mode: 0o700 });
        }
        const logger = this.logger;
        const resolveKeyPath = (key) => {
            if (!(0, path_safety_1.isSafeStorageKey)(key))
                return null;
            const fileName = `${encodeStorageKey(key)}.json`;
            return (0, path_safety_1.isPathWithin)(pluginDataDir, fileName) ? path.join(pluginDataDir, fileName) : null;
        };
        const resolveLegacyKeyPath = (key) => {
            if (!(0, path_safety_1.isSafeStorageKey)(key))
                return null;
            const fileName = `${key}.json`;
            return (0, path_safety_1.isPathWithin)(pluginDataDir, fileName) ? path.join(pluginDataDir, fileName) : null;
        };
        return {
            get: (key) => {
                const filePath = resolveKeyPath(key);
                if (!filePath) {
                    logger.warn(`Refusing to read plugin data with an unsafe key: ${pluginId}/${key}`);
                    return Promise.resolve(null);
                }
                try {
                    const legacyPath = resolveLegacyKeyPath(key);
                    const candidates = legacyPath && legacyPath !== filePath ? [filePath, legacyPath] : [filePath];
                    for (const candidate of candidates) {
                        if (fs.existsSync(candidate)) {
                            const content = fs.readFileSync(candidate, 'utf-8');
                            return Promise.resolve(JSON.parse(content));
                        }
                    }
                }
                catch (error) {
                    logger.error(`Failed to read plugin data: ${pluginId}/${key}`, String(error));
                }
                return Promise.resolve(null);
            },
            set: (key, value) => {
                const filePath = resolveKeyPath(key);
                if (!filePath) {
                    return Promise.reject(new Error(`Unsafe plugin storage key: ${key}`));
                }
                try {
                    atomicWriteFileSync(filePath, JSON.stringify(value, null, 2), { mode: 0o600 });
                    fs.chmodSync(filePath, 0o600);
                    const legacyPath = resolveLegacyKeyPath(key);
                    if (legacyPath && legacyPath !== filePath && fs.existsSync(legacyPath)) {
                        fs.unlinkSync(legacyPath);
                    }
                    return Promise.resolve();
                }
                catch (error) {
                    logger.error(`Failed to write plugin data: ${pluginId}/${key}`, String(error));
                    return Promise.reject(new Error(error instanceof Error ? error.message : String(error)));
                }
            },
            delete: (key) => {
                const filePath = resolveKeyPath(key);
                if (!filePath) {
                    return Promise.reject(new Error(`Unsafe plugin storage key: ${key}`));
                }
                try {
                    const legacyPath = resolveLegacyKeyPath(key);
                    const candidates = legacyPath && legacyPath !== filePath ? [filePath, legacyPath] : [filePath];
                    for (const candidate of candidates) {
                        if (fs.existsSync(candidate)) {
                            fs.unlinkSync(candidate);
                        }
                    }
                    return Promise.resolve();
                }
                catch (error) {
                    logger.error(`Failed to delete plugin data: ${pluginId}/${key}`, String(error));
                    return Promise.reject(new Error(error instanceof Error ? error.message : String(error)));
                }
            },
            list: (prefix) => {
                try {
                    const files = fs.readdirSync(pluginDataDir);
                    let keys = Array.from(new Set(files
                        .filter(f => f.endsWith('.json'))
                        .map(f => f.slice(0, -'.json'.length))
                        .map(stem => decodeStorageFileName(stem) ?? stem)));
                    if (prefix) {
                        keys = keys.filter(k => k.startsWith(prefix));
                    }
                    return Promise.resolve(keys);
                }
                catch (error) {
                    logger.error(`Failed to list plugin data: ${pluginId}`, String(error));
                    return Promise.resolve([]);
                }
            },
        };
    }
};
exports.PluginStorageService = PluginStorageService;
exports.PluginStorageService = PluginStorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PluginStorageService);
//# sourceMappingURL=plugin-storage.service.js.map