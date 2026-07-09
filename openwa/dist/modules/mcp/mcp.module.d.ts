import { type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ToolRegistryService } from '../../core/agent-tools/tool-registry.service';
import { AuthService } from '../auth/auth.service';
export interface McpModuleOptions {
    basePath?: string;
    serverInfo?: {
        name: string;
        version: string;
    };
}
export declare class McpModule implements NestModule {
    private readonly registry;
    private readonly authService;
    private readonly httpAdapterHost;
    constructor(registry: ToolRegistryService, authService: AuthService, httpAdapterHost: HttpAdapterHost);
    static forRoot(options?: McpModuleOptions): DynamicModule;
    configure(_consumer: MiddlewareConsumer): void;
}
