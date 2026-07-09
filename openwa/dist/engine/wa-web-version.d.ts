export type WebVersionPin = {
    webVersion: string;
    webVersionCache: {
        type: 'remote';
        remotePath: string;
    };
};
export declare const WA_VERSION_REGISTRY_URL = "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json";
export declare function __resetWebVersionCache(): void;
export declare function resolveCurrentWebVersion(fetcher?: typeof fetch): Promise<string | null>;
export declare function resolveWebVersionPin(fetcher?: typeof fetch): Promise<WebVersionPin | undefined>;
export declare function getEffectiveWebVersionInfo(): {
    version: string | null;
    source: 'pinned' | 'auto' | 'native';
};
