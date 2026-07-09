import type { HttpAdapterHost } from '@nestjs/core';
import { type RequestHandler } from 'express';
import type { ToolRegistryService } from '../../core/agent-tools/tool-registry.service';
import type { AuthService } from '../auth/auth.service';
import type { KeyRateLimiter } from './mcp-rate-limit';
type HttpAdapter = NonNullable<HttpAdapterHost['httpAdapter']>;
export interface MountMcpServerOptions {
    basePath?: string;
    serverInfo?: {
        name: string;
        version: string;
    };
    readOnly?: boolean;
}
export declare function createIpThrottle(ipRateLimiter: KeyRateLimiter): RequestHandler;
export declare function resolveMcpReadOnly(optionsReadOnly?: boolean): boolean;
export declare function mountMcpServer(httpAdapter: HttpAdapter, registry: ToolRegistryService, authService: AuthService, rateLimiter: KeyRateLimiter, ipRateLimiter: KeyRateLimiter, options?: MountMcpServerOptions): void;
export {};
