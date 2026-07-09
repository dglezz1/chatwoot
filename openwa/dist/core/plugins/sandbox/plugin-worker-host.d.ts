import { PluginWorkerChannel, PluginLifecycleMethod, SandboxStaticContext, PluginLogLevel } from './protocol';
export declare class PluginWorkerHost {
    private readonly channel;
    private readonly capDispatcher?;
    private readonly onHookSubscribe?;
    private readonly onWebhookSubscribe?;
    private readonly onLog?;
    private readonly runWithHookGuard?;
    private readonly maxInFlightCaps?;
    private nextId;
    private ready;
    private dead;
    private readyWaiters;
    private readonly pending;
    private readonly hookPending;
    private readonly webhookPending;
    private readonly healthPending;
    private readonly inFlightHookEvents;
    private inFlightCaps;
    constructor(channel: PluginWorkerChannel, capDispatcher?: ((verb: string, args: unknown[]) => Promise<unknown>) | undefined, onHookSubscribe?: ((event: string, priority?: number) => void) | undefined, onWebhookSubscribe?: ((route: string) => void) | undefined, onLog?: ((level: PluginLogLevel, message: string, meta?: Record<string, unknown>) => void) | undefined, runWithHookGuard?: ((inFlightEvents: string[], run: () => Promise<unknown>) => Promise<unknown>) | undefined, maxInFlightCaps?: number | undefined);
    private incInFlightHook;
    private decInFlightHook;
    dispatchHook(options: {
        event: string;
        data: unknown;
        source: string;
        sessionId?: string;
        config?: Record<string, unknown>;
        timeoutMs: number;
        onTimeout?: () => void;
    }): Promise<{
        continue: boolean;
        data?: unknown;
    }>;
    dispatchWebhook(options: {
        instanceId: string;
        route: string;
        method: string;
        headers: Record<string, string>;
        query: Record<string, string>;
        body: string;
        rawBody: string;
        verified: boolean;
        deliveryId: string;
        sessionId?: string;
        config?: Record<string, unknown>;
        timeoutMs: number;
        onTimeout?: () => void;
    }): Promise<{
        status: number;
        headers?: Record<string, string>;
        body?: string;
        ok: boolean;
        error?: string;
    }>;
    load(mainPath: string, context?: SandboxStaticContext, timeoutMs?: number): Promise<void>;
    runLifecycle(method: PluginLifecycleMethod, timeoutMs?: number): Promise<void>;
    sendConfigChange(config: Record<string, unknown>): void;
    healthCheck(timeoutMs: number): Promise<{
        healthy: boolean;
        message?: string;
    }>;
    terminate(): Promise<void>;
    private handleMessage;
    private handleCapRequest;
    private handleExit;
    private drain;
}
