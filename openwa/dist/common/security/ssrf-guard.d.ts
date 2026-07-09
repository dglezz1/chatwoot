import { type LookupFunction } from 'net';
import { type LookupAddress } from 'dns';
import { type RequestInit, type Response } from 'undici';
export declare class SsrfBlockedError extends Error {
    constructor(message: string);
}
export declare const SSRF_BLOCKED_CLIENT_MESSAGE = "Destination address is not allowed";
export declare function isSsrfProtectionEnabled(): boolean;
export declare function isBlockedAddress(ip: string): boolean;
export declare function assertNoRedirect(response: {
    status: number;
    type?: string;
}, url: string): void;
export declare function resolveSafeFetchTarget(rawUrl: string): Promise<LookupAddress[] | null>;
export declare function assertSafeFetchUrl(rawUrl: string): Promise<void>;
export declare function pinnedLookup(addresses: LookupAddress[]): LookupFunction;
export declare function validatingLookup(): LookupFunction;
export declare function withSafeFetch<T>(rawUrl: string, init: RequestInit, use: (response: Response) => Promise<T> | T, opts?: {
    guard?: boolean;
    followRedirects?: boolean;
}): Promise<T>;
