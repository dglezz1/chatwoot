import type { z } from 'zod';
import type { ApiKey } from '../../modules/auth/entities/api-key.entity';
import type { ApiKeyRole } from '../../modules/auth/entities/api-key.entity';
export interface ToolDescriptor<I = unknown> {
    name: string;
    description: string;
    inputSchema: z.ZodType<I>;
    tier: 'read' | 'write';
    destructive?: boolean;
    idempotent?: boolean;
    requiredRole?: ApiKeyRole;
    sessionScoped?: boolean;
    resultDisposition?: 'json' | 'smart';
    handler: (input: I, apiKey: ApiKey) => Promise<unknown>;
}
