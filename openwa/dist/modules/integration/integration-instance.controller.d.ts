import { AuditService } from '../audit/audit.service';
import { PluginLoaderService } from '../../core/plugins/plugin-loader.service';
import { PluginInstanceService } from './plugin-instance.service';
import { ScopeBindingService } from './scope-binding.service';
import { CreateInstanceDto, InstanceView, UpdateInstanceDto } from './dto/instance.dto';
export declare class IntegrationInstanceController {
    private readonly instances;
    private readonly loader;
    private readonly audit;
    private readonly scopeBinding;
    constructor(instances: PluginInstanceService, loader: PluginLoaderService, audit: AuditService, scopeBinding: ScopeBindingService);
    create(pluginId: string, dto: CreateInstanceDto): Promise<InstanceView>;
    list(pluginId: string): Promise<InstanceView[]>;
    getOne(pluginId: string, instanceId: string): Promise<InstanceView>;
    regenerate(pluginId: string, instanceId: string): Promise<InstanceView>;
    patch(pluginId: string, instanceId: string, dto: UpdateInstanceDto): Promise<InstanceView>;
    remove(pluginId: string, instanceId: string): Promise<void>;
    private assertIngressCapable;
    private pluginRoutes;
    private schemaFor;
    private view;
}
