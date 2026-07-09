import { LoggerService as NestLoggerService } from '@nestjs/common';
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug",
    VERBOSE = "verbose"
}
export declare enum LogFormat {
    JSON = "json",
    PRETTY = "pretty"
}
export interface LogContext {
    sessionId?: string;
    messageId?: string;
    webhookId?: string;
    action?: string;
    duration?: number;
    [key: string]: unknown;
}
export declare class LoggerService implements NestLoggerService {
    private context;
    private static logLevel;
    private static logFormat;
    static setLogLevel(level: LogLevel): void;
    static setLogFormat(format: LogFormat | null): void;
    setContext(context: string): void;
    log(message: string, context?: string | LogContext): void;
    error(message: string, trace?: string, context?: string | LogContext): void;
    warn(message: string, context?: string | LogContext): void;
    debug(message: string, context?: string | LogContext): void;
    verbose(message: string, context?: string | LogContext): void;
    private writeLog;
    private formatPretty;
    private static resolveFormat;
    private static colorEnabled;
    private shouldLog;
}
export declare function createLogger(context: string): LoggerService;
