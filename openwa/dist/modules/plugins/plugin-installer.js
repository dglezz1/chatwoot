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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTALLABLE_TYPES = exports.RESERVED_PLUGIN_IDS = exports.DEFAULT_PACKAGE_LIMITS = void 0;
exports.parsePluginPackage = parsePluginPackage;
const adm_zip_1 = __importDefault(require("adm-zip"));
const path = __importStar(require("path"));
const common_1 = require("@nestjs/common");
const plugins_1 = require("../../core/plugins");
exports.DEFAULT_PACKAGE_LIMITS = { maxEntries: 200, maxTotalBytes: 20 * 1024 * 1024 };
exports.RESERVED_PLUGIN_IDS = new Set(['whatsapp-web.js', 'baileys', 'auto-reply', 'translation']);
exports.INSTALLABLE_TYPES = new Set([plugins_1.PluginType.EXTENSION]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]*$/i;
const REQUIRED_FIELDS = ['id', 'name', 'version', 'type', 'main'];
function parsePluginPackage(buffer, limits = exports.DEFAULT_PACKAGE_LIMITS) {
    let zip;
    try {
        zip = new adm_zip_1.default(buffer);
    }
    catch {
        throw new common_1.BadRequestException('Uploaded file is not a valid .zip archive');
    }
    const files = zip.getEntries().filter(e => !e.isDirectory);
    if (files.length === 0)
        throw new common_1.BadRequestException('The archive is empty');
    if (files.length > limits.maxEntries)
        throw new common_1.BadRequestException('The archive has too many files');
    const manifestEntry = files
        .filter(e => path.posix.basename(e.entryName) === 'manifest.json')
        .sort((a, b) => a.entryName.split('/').length - b.entryName.split('/').length)[0];
    if (!manifestEntry)
        throw new common_1.BadRequestException('The archive has no manifest.json');
    const dir = path.posix.dirname(manifestEntry.entryName);
    const prefix = dir === '.' ? '' : dir + '/';
    let parsed;
    try {
        parsed = JSON.parse(manifestEntry.getData().toString('utf-8'));
    }
    catch {
        throw new common_1.BadRequestException('manifest.json is not valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new common_1.BadRequestException('manifest.json must be a JSON object');
    }
    const manifest = parsed;
    for (const field of REQUIRED_FIELDS) {
        if (typeof manifest[field] !== 'string' || manifest[field].length === 0) {
            throw new common_1.BadRequestException(`manifest.json is missing or has an invalid required field: ${field}`);
        }
    }
    if (!SAFE_ID.test(manifest.id) || manifest.id.includes('..')) {
        throw new common_1.BadRequestException(`Invalid plugin id: "${manifest.id}"`);
    }
    if (exports.RESERVED_PLUGIN_IDS.has(manifest.id.toLowerCase())) {
        throw new common_1.BadRequestException(`Plugin id "${manifest.id}" is reserved by a built-in plugin`);
    }
    if (!exports.INSTALLABLE_TYPES.has(manifest.type)) {
        throw new common_1.BadRequestException(`Plugin type "${manifest.type}" is not installable — only extension plugins can be installed (engines and other tiers are built-in).`);
    }
    const packaged = files.filter(e => !prefix || e.entryName.startsWith(prefix));
    const declared = packaged.reduce((sum, e) => sum + e.header.size, 0);
    if (declared > limits.maxTotalBytes)
        throw new common_1.BadRequestException('The archive contents exceed the size limit');
    const entries = [];
    for (const e of packaged) {
        const relPath = e.entryName.slice(prefix.length);
        if (!relPath)
            continue;
        const norm = path.posix.normalize(relPath);
        if (relPath.includes('\\') || norm.startsWith('..') || norm === '..' || path.posix.isAbsolute(norm)) {
            throw new common_1.BadRequestException(`Unsafe path in archive: ${e.entryName}`);
        }
        entries.push({ relPath: norm, data: e.getData() });
    }
    const mainRel = path.posix.normalize(manifest.main);
    if (!entries.some(en => en.relPath === mainRel)) {
        throw new common_1.BadRequestException(`The archive is missing its main file: ${manifest.main}`);
    }
    return { manifest, entries };
}
//# sourceMappingURL=plugin-installer.js.map