interface FatalLogger {
    error: (message: string, detail?: string) => void;
}
export declare function registerUncaughtExceptionMonitor(logger: FatalLogger): void;
export {};
