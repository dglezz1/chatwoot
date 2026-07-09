export declare function normalizeIp(ip: string): string;
export interface RequestLike {
    ip?: string;
    socket?: {
        remoteAddress?: string;
    };
    headers: Record<string, string | string[] | undefined>;
}
export declare function resolveClientIp(req: RequestLike, trustedProxies: string[]): string;
export declare function ipMatches(ip: string, target: string): boolean;
