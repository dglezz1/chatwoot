export declare function isPluginActiveForSession(sessionScoped: boolean, activeSessions: string[], sessionId: string | undefined): boolean;
export declare function resolvePluginConfig(base: Record<string, unknown>, sessionConfig: Record<string, Record<string, unknown>> | undefined, sessionId: string | undefined, sessionScoped: boolean): Record<string, unknown>;
