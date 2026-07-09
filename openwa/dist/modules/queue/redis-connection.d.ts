export interface WorkerConnectionOptions {
    host: string;
    port: number;
    username?: string;
    password?: string;
    connectTimeout: number;
}
export declare function workerConnectionOptions(): WorkerConnectionOptions;
export declare function webhookWorkerConcurrency(): number;
export declare function ingressWorkerConcurrency(): number;
