import { OnApplicationBootstrap } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PluginLoaderService } from '../../core/plugins/plugin-loader.service';
import { PluginInstanceService } from './plugin-instance.service';
export declare class ScopeBindingService implements OnApplicationBootstrap {
    private readonly instances;
    private readonly loader;
    private readonly audit;
    private readonly logger;
    constructor(instances: PluginInstanceService, loader: PluginLoaderService, audit: AuditService);
    onApplicationBootstrap(): Promise<void>;
    applyScopeBinding(pluginId: string, scope: string | null, config: Record<string, unknown>, activate: boolean): Promise<void>;
}
