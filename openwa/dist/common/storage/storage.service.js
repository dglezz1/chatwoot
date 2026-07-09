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
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const archiver_1 = require("archiver");
const tar = __importStar(require("tar-stream"));
const zlib_1 = require("zlib");
const stream_1 = require("stream");
const client_s3_1 = require("@aws-sdk/client-s3");
const logger_service_1 = require("../services/logger.service");
const path_safety_1 = require("../utils/path-safety");
const DEFAULT_IMPORT_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_IMPORT_MAX_ENTRIES = 100_000;
function positiveIntFromEnv(name, fallback) {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
let StorageService = class StorageService {
    configService;
    logger = (0, logger_service_1.createLogger)('StorageService');
    storageType;
    localPath;
    s3Client = null;
    s3Bucket = 'openwa';
    s3Available = false;
    constructor(configService) {
        this.configService = configService;
        this.storageType = this.configService.get('storage.type') || 'local';
        this.localPath = this.configService.get('storage.localPath') || './data/media';
        if (this.storageType === 's3') {
            const s3Config = this.configService.get('storage.s3') || {};
            const endpoint = process.env.S3_ENDPOINT || s3Config.endpoint;
            const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || s3Config.accessKeyId;
            const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || s3Config.secretAccessKey;
            const region = process.env.S3_REGION || s3Config.region || 'us-east-1';
            if (endpoint && accessKeyId && secretAccessKey) {
                this.s3Client = new client_s3_1.S3Client({
                    endpoint,
                    region,
                    credentials: {
                        accessKeyId,
                        secretAccessKey,
                    },
                    forcePathStyle: true,
                });
                this.s3Bucket = process.env.S3_BUCKET || s3Config.bucket || 'openwa';
                void this.initializeS3Bucket();
            }
        }
        if (!fs.existsSync(this.localPath)) {
            fs.mkdirSync(this.localPath, { recursive: true });
        }
    }
    async initializeS3Bucket() {
        if (!this.s3Client)
            return;
        try {
            await this.s3Client.send(new client_s3_1.HeadBucketCommand({ Bucket: this.s3Bucket }));
            this.s3Available = true;
            this.logger.log(`S3 bucket '${this.s3Bucket}' is available`);
        }
        catch (error) {
            const err = error;
            if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
                try {
                    await this.s3Client.send(new client_s3_1.CreateBucketCommand({ Bucket: this.s3Bucket }));
                    this.s3Available = true;
                    this.logger.log(`Created S3 bucket '${this.s3Bucket}'`);
                }
                catch (createError) {
                    this.logger.error('Failed to create S3 bucket', String(createError));
                }
            }
            else {
                this.logger.error('S3 bucket check failed', String(error));
            }
        }
    }
    getCurrentStorageType() {
        return this.storageType;
    }
    isS3Available() {
        return this.s3Available;
    }
    lastS3Check = 0;
    s3CheckInFlight = null;
    async refreshS3Availability() {
        if (this.storageType !== 's3' || !this.s3Client || this.s3Available)
            return this.s3Available;
        if (this.s3CheckInFlight) {
            await this.s3CheckInFlight;
            return this.s3Available;
        }
        const now = Date.now();
        if (now - this.lastS3Check < 10_000)
            return this.s3Available;
        this.lastS3Check = now;
        this.s3CheckInFlight = (async () => {
            try {
                await this.s3Client.send(new client_s3_1.HeadBucketCommand({ Bucket: this.s3Bucket }));
                this.s3Available = true;
                this.logger.log(`S3 bucket '${this.s3Bucket}' is now reachable`);
            }
            catch {
            }
            finally {
                this.s3CheckInFlight = null;
            }
        })();
        await this.s3CheckInFlight;
        return this.s3Available;
    }
    async listFiles() {
        if (this.storageType === 's3' && this.s3Client && this.s3Available) {
            return this.listS3Files();
        }
        return this.listLocalFiles();
    }
    async getFile(filePath) {
        if (!(0, path_safety_1.isSafeStorageKey)(filePath)) {
            throw new Error(`Refusing to read an unsafe storage key: ${filePath}`);
        }
        if (this.storageType === 's3' && this.s3Client && this.s3Available) {
            return this.getS3File(filePath);
        }
        return this.getLocalFile(filePath);
    }
    async putFile(filePath, data) {
        if (!(0, path_safety_1.isSafeStorageKey)(filePath)) {
            throw new Error(`Refusing to store an unsafe storage key: ${filePath}`);
        }
        if (this.storageType === 's3' && this.s3Client && this.s3Available) {
            return this.putS3File(filePath, data);
        }
        return this.putLocalFile(filePath, data);
    }
    async getFileCount() {
        if (this.storageType === 's3' && this.s3Client && this.s3Available) {
            return this.getS3CountAndSize();
        }
        const files = await this.listFiles();
        let sizeBytes = 0;
        for (const file of files) {
            try {
                const fullPath = path.join(this.localPath, file);
                const stats = fs.statSync(fullPath);
                sizeBytes += stats.size;
            }
            catch (error) {
                this.logger.debug(`Failed to stat file: ${file}`, { error: String(error) });
            }
        }
        return { count: files.length, sizeBytes };
    }
    async getS3CountAndSize() {
        let count = 0;
        let sizeBytes = 0;
        let continuationToken;
        do {
            const response = await this.s3Client.send(new client_s3_1.ListObjectsV2Command({
                Bucket: this.s3Bucket,
                Prefix: 'media/',
                ContinuationToken: continuationToken,
            }));
            for (const obj of response.Contents ?? []) {
                count += 1;
                sizeBytes += obj.Size ?? 0;
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        return { count, sizeBytes };
    }
    async createExportStream() {
        const files = await this.listFiles();
        const output = new stream_1.PassThrough();
        const archive = new archiver_1.TarArchive({
            gzip: true,
            gzipOptions: { level: 6 },
        });
        archive.on('error', (err) => {
            this.logger.error('Export archive failed', String(err));
            output.destroy(err);
        });
        archive.pipe(output);
        for (const file of files) {
            try {
                const data = await this.getFile(file);
                archive.append(data, { name: file });
            }
            catch (error) {
                this.logger.warn(`Failed to export file: ${file}`, { error: String(error) });
            }
        }
        archive.finalize().catch(() => undefined);
        return output;
    }
    async importFromStream(inputStream) {
        let importedCount = 0;
        let entryCount = 0;
        const maxEntryBytes = positiveIntFromEnv('STORAGE_IMPORT_MAX_BYTES', DEFAULT_IMPORT_MAX_BYTES);
        const maxEntries = positiveIntFromEnv('STORAGE_IMPORT_MAX_ENTRIES', DEFAULT_IMPORT_MAX_ENTRIES);
        const extract = tar.extract();
        const gunzip = (0, zlib_1.createGunzip)();
        return new Promise((resolve, reject) => {
            let settled = false;
            const fail = (err) => {
                if (settled)
                    return;
                settled = true;
                extract.destroy();
                reject(err);
            };
            extract.on('entry', (header, stream, next) => {
                if (settled) {
                    stream.resume();
                    return;
                }
                if (++entryCount > maxEntries) {
                    stream.resume();
                    fail(new Error(`Import aborted: archive exceeds the ${maxEntries}-entry limit`));
                    return;
                }
                const chunks = [];
                let entryBytes = 0;
                let entryAborted = false;
                stream.on('data', (chunk) => {
                    if (entryAborted || settled)
                        return;
                    entryBytes += chunk.length;
                    if (entryBytes > maxEntryBytes) {
                        entryAborted = true;
                        stream.resume();
                        fail(new Error(`Import aborted: entry "${header.name}" exceeds the ${maxEntryBytes}-byte per-entry cap`));
                    }
                    else {
                        chunks.push(chunk);
                    }
                });
                stream.on('end', () => {
                    if (entryAborted || settled)
                        return;
                    const data = Buffer.concat(chunks);
                    this.putFile(header.name, data)
                        .then(() => {
                        importedCount++;
                        this.logger.debug(`Imported file: ${header.name}`);
                        next();
                    })
                        .catch((error) => {
                        this.logger.error(`Failed to import file: ${header.name}`, String(error));
                        next();
                    });
                });
                stream.resume();
            });
            extract.on('finish', () => {
                if (settled)
                    return;
                settled = true;
                this.logger.log(`Import completed: ${importedCount} files`);
                resolve(importedCount);
            });
            extract.on('error', (err) => {
                this.logger.error('Import failed', String(err));
                fail(err);
            });
            inputStream.pipe(gunzip).pipe(extract);
        });
    }
    listLocalFiles(dir = '') {
        const fullPath = path.join(this.localPath, dir);
        const files = [];
        if (!fs.existsSync(fullPath)) {
            return files;
        }
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const entry of entries) {
            const relativePath = dir ? path.join(dir, entry.name) : entry.name;
            if (entry.isDirectory()) {
                files.push(...this.listLocalFiles(relativePath));
            }
            else if (entry.isFile()) {
                files.push(relativePath);
            }
        }
        return files;
    }
    getLocalFile(filePath) {
        if (!(0, path_safety_1.isPathWithin)(this.localPath, filePath)) {
            throw new Error(`Refusing to read outside storage root: ${filePath}`);
        }
        const fullPath = path.join(this.localPath, filePath);
        return fs.promises.readFile(fullPath);
    }
    async putLocalFile(filePath, data) {
        if (!(0, path_safety_1.isPathWithin)(this.localPath, filePath)) {
            throw new Error(`Refusing to write outside storage root: ${filePath}`);
        }
        const fullPath = path.join(this.localPath, filePath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, data);
    }
    async listS3Files() {
        if (!this.s3Client)
            return [];
        const files = [];
        let continuationToken;
        do {
            const response = await this.s3Client.send(new client_s3_1.ListObjectsV2Command({
                Bucket: this.s3Bucket,
                Prefix: 'media/',
                ContinuationToken: continuationToken,
            }));
            if (response.Contents) {
                for (const obj of response.Contents) {
                    if (obj.Key) {
                        files.push(obj.Key.replace(/^media\//, ''));
                    }
                }
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        return files;
    }
    async getS3File(filePath) {
        if (!this.s3Client)
            throw new Error('S3 client not initialized');
        const response = await this.s3Client.send(new client_s3_1.GetObjectCommand({
            Bucket: this.s3Bucket,
            Key: `media/${filePath}`,
        }));
        if (!response.Body)
            throw new Error('Empty response body');
        const chunks = [];
        const stream = response.Body;
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    async putS3File(filePath, data) {
        if (!this.s3Client)
            throw new Error('S3 client not initialized');
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.s3Bucket,
            Key: `media/${filePath}`,
            Body: data,
        }));
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map