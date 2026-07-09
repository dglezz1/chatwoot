import { Repository } from 'typeorm';
import { PluginInstance } from './entities/plugin-instance.entity';
import type { PluginConfigSchema } from '../../core/plugins/plugin.interfaces';
export declare class InstanceExistsError extends Error {
    constructor(pluginId: string, instanceId: string);
}
export declare class PluginInstanceService {
    private readonly repo;
    constructor(repo: Repository<PluginInstance>);
    mint(pluginId: string, instanceId: string, opts: {
        sessionScope?: string;
        verifyToken?: string;
        secret?: string;
        config?: Record<string, unknown>;
    }): Promise<PluginInstance>;
    resolve(pluginId: string, instanceId: string): Promise<PluginInstance | null>;
    maskedView(instance: PluginInstance, schema?: PluginConfigSchema): PluginInstance;
    create(pluginId: string, instanceId: string, opts: {
        sessionScope?: string;
        verifyToken?: string;
        secret?: string;
        config?: Record<string, unknown>;
    }): Promise<PluginInstance>;
    list(pluginId: string): Promise<PluginInstance[]>;
    listAll(): Promise<PluginInstance[]>;
    regenerateSecret(pluginId: string, instanceId: string): Promise<PluginInstance>;
    setEnabled(pluginId: string, instanceId: string, enabled: boolean): Promise<PluginInstance | null>;
    update(pluginId: string, instanceId: string, patch: {
        sessionScope?: string;
        config?: Record<string, unknown>;
    }, schema?: PluginConfigSchema): Promise<PluginInstance | null>;
    remove(pluginId: string, instanceId: string): Promise<boolean>;
}
