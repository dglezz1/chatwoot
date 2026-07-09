import { ConfigService } from '@nestjs/config';
import { Readable, PassThrough } from 'stream';
export declare class StorageService {
    private readonly configService;
    private readonly logger;
    private readonly storageType;
    private readonly localPath;
    private s3Client;
    private s3Bucket;
    private s3Available;
    constructor(configService: ConfigService);
    private initializeS3Bucket;
    getCurrentStorageType(): string;
    isS3Available(): boolean;
    private lastS3Check;
    private s3CheckInFlight;
    refreshS3Availability(): Promise<boolean>;
    listFiles(): Promise<string[]>;
    getFile(filePath: string): Promise<Buffer>;
    putFile(filePath: string, data: Buffer): Promise<void>;
    getFileCount(): Promise<{
        count: number;
        sizeBytes: number;
    }>;
    private getS3CountAndSize;
    createExportStream(): Promise<PassThrough>;
    importFromStream(inputStream: Readable): Promise<number>;
    private listLocalFiles;
    private getLocalFile;
    private putLocalFile;
    private listS3Files;
    private getS3File;
    private putS3File;
}
