import type { PluginConfigSchema, PluginI18n } from '../../../core/plugins';
import { PluginType, PluginStatus } from '../../../core/plugins';
export declare class PluginDto {
    id: string;
    name: string;
    version: string;
    type: PluginType;
    description?: string;
    author?: string;
    status: PluginStatus;
    config: Record<string, unknown>;
    builtIn: boolean;
    provides: string[];
    ingressCapable: boolean;
    sessionScoped: boolean;
    activeSessions: string[];
    configSchema?: PluginConfigSchema;
    configUi?: {
        entry: string;
        height?: number;
    };
    i18n?: PluginI18n;
    sessionConfig?: Record<string, Record<string, unknown>>;
    loadedAt?: string;
    enabledAt?: string;
    error?: string;
}
export declare class PluginConfigDto {
    config: Record<string, unknown>;
}
export declare class PluginSessionsDto {
    sessions: string[];
}
export declare class InstallFromUrlDto {
    url: string;
}
