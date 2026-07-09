import { HookEvent, HookHandler } from './hook.interfaces';
export declare class HookManager {
    private readonly logger;
    private readonly hooks;
    private readonly pluginHooks;
    private readonly inFlightEvents;
    register(pluginId: string, event: HookEvent, handler: HookHandler, priority?: number): string;
    unregister(hookId: string): void;
    unregisterPlugin(pluginId: string): void;
    execute<T>(event: HookEvent, data: T, options: {
        sessionId?: string;
        source: string;
    }): Promise<{
        continue: boolean;
        data: T;
    }>;
    runInFlight<T>(events: Iterable<HookEvent>, fn: () => T): T;
    isInFlight(event: HookEvent): boolean;
    private runHandlers;
    hasHooks(event: HookEvent): boolean;
    getHookCount(event: HookEvent): number;
    getRegisteredHooks(): Record<HookEvent, {
        pluginId: string;
        priority: number;
    }[]>;
    getPluginEvents(pluginId: string): HookEvent[];
}
