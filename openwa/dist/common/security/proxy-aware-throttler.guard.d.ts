import { ThrottlerGuard } from '@nestjs/throttler';
export declare class ProxyAwareThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: Record<string, unknown>): Promise<string>;
}
