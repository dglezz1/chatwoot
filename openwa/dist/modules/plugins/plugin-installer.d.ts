import { PluginManifest } from '../../core/plugins';
export interface PackageLimits {
    maxEntries: number;
    maxTotalBytes: number;
}
export declare const DEFAULT_PACKAGE_LIMITS: PackageLimits;
export declare const RESERVED_PLUGIN_IDS: Set<string>;
export declare const INSTALLABLE_TYPES: Set<string>;
export interface ParsedPackage {
    manifest: PluginManifest;
    entries: {
        relPath: string;
        data: Buffer;
    }[];
}
export declare function parsePluginPackage(buffer: Buffer, limits?: PackageLimits): ParsedPackage;
