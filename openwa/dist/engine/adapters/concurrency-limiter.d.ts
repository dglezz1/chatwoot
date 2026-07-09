export declare class ConcurrencyLimiter {
    private readonly max;
    private active;
    private readonly waiters;
    constructor(max: number);
    run<T>(task: () => Promise<T>): Promise<T>;
}
