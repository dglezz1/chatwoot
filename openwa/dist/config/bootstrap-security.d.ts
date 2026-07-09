export interface CorsPolicy {
    origins: string[];
    allowAnyOrigin: boolean;
    credentials: boolean;
}
export declare function resolveCorsPolicy(corsOriginsEnv?: string, nodeEnv?: string): CorsPolicy;
export declare function isSwaggerEnabled(enableSwaggerEnv?: string, nodeEnv?: string): boolean;
export declare function isValidationErrorDetailEnabled(validationDetailEnv?: string, nodeEnv?: string): boolean;
export declare function isUpgradeInsecureRequestsEnabled(cspEnv?: string, nodeEnv?: string): boolean;
export declare function resolveBodyLimit(bodySizeEnv?: string): string;
export declare function isApiKeyPepperMissingInProduction(nodeEnv?: string, apiKeyPepper?: string): boolean;
export interface SecretCheckEnv {
    nodeEnv?: string;
    databaseType?: string;
    databasePassword?: string;
    postgresBuiltIn?: string;
    databaseHost?: string;
    storageType?: string;
    s3AccessKey?: string;
    s3SecretKey?: string;
    s3Endpoint?: string;
    minioBuiltIn?: string;
    apiMasterKey?: string;
    allowDevApiKey?: string;
    redisPassword?: string;
}
export declare function assertNoDefaultSecretsInProduction(env: SecretCheckEnv): void;
