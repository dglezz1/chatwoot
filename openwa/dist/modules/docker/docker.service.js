"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var DockerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerService = exports.MANAGED_DOCKER_PROFILES = void 0;
const common_1 = require("@nestjs/common");
const dockerode_1 = __importDefault(require("dockerode"));
exports.MANAGED_DOCKER_PROFILES = ['postgres', 'redis', 'minio'];
let DockerService = DockerService_1 = class DockerService {
    logger = new common_1.Logger(DockerService_1.name);
    docker = null;
    isAvailable = false;
    reinitInFlight = false;
    async onModuleInit() {
        await this.initializeDocker();
        await this.bootstrapOrchestration();
    }
    async bootstrapOrchestration() {
        if (!this.isAvailable) {
            this.logger.log('[Bootstrap Orchestration] Docker not available, skipping');
            return;
        }
        const profiles = [];
        if (process.env.REDIS_BUILTIN === 'true') {
            profiles.push('redis');
        }
        if (process.env.POSTGRES_BUILTIN === 'true') {
            profiles.push('postgres');
        }
        if (process.env.MINIO_BUILTIN === 'true') {
            profiles.push('minio');
        }
        if (profiles.length === 0) {
            this.logger.log('[Bootstrap Orchestration] No built-in services configured');
            return;
        }
        this.logger.log(`[Bootstrap Orchestration] Starting built-in services: ${profiles.join(', ')}`);
        const result = await this.orchestrateProfiles(profiles);
        if (result.success) {
            this.logger.log(`[Bootstrap Orchestration] Started ${result.containersStarted.length} container(s)`);
        }
        else {
            this.logger.warn(`[Bootstrap Orchestration] Issues: ${result.errors.join('; ')}`);
        }
    }
    async initializeDocker() {
        try {
            this.docker = new dockerode_1.default(this.buildDockerOptions());
            await this.docker.ping();
            this.isAvailable = true;
            this.logger.log('Docker API connected successfully');
        }
        catch (error) {
            this.logger.warn('Docker not available. Container orchestration disabled.', error instanceof Error ? error.message : error);
            this.isAvailable = false;
        }
    }
    buildDockerOptions() {
        const dockerHost = process.env.DOCKER_HOST;
        if (dockerHost) {
            const match = /^tcp:\/\/([^:]+):(\d+)$/.exec(dockerHost);
            if (match) {
                return { host: match[1], port: parseInt(match[2], 10), protocol: 'http' };
            }
        }
        return { socketPath: '/var/run/docker.sock' };
    }
    isDockerAvailable() {
        if (!this.isAvailable && !this.reinitInFlight && process.env.DOCKER_HOST) {
            this.reinitInFlight = true;
            void this.initializeDocker().finally(() => {
                this.reinitInFlight = false;
            });
        }
        return this.isAvailable;
    }
    async listContainers() {
        if (!this.docker || !this.isAvailable) {
            return [];
        }
        try {
            const containers = await this.docker.listContainers({ all: true });
            return containers
                .filter(c => {
                const labels = c.Labels || {};
                return labels['com.openwa.service'] || c.Names?.some(n => n.startsWith('/openwa-'));
            })
                .map(c => ({
                id: c.Id.substring(0, 12),
                name: c.Names?.[0]?.replace(/^\//, '') || 'unknown',
                state: c.State || 'unknown',
                status: c.Status || 'unknown',
                labels: c.Labels || {},
            }));
        }
        catch (error) {
            this.logger.error('Failed to list containers', error);
            return [];
        }
    }
    async getRunningBuiltinServices() {
        const containers = await this.listContainers();
        const isRunning = (svc) => containers.some(c => c.labels['com.openwa.service'] === svc && c.labels['com.openwa.builtin'] === 'true' && c.state === 'running');
        return { database: isRunning('database'), cache: isRunning('cache'), storage: isRunning('storage') };
    }
    async getContainerByService(service) {
        if (!this.docker || !this.isAvailable) {
            return null;
        }
        try {
            const containers = await this.docker.listContainers({
                all: true,
                filters: {
                    label: [`com.openwa.service=${service}`],
                },
            });
            if (containers.length > 0) {
                return this.docker.getContainer(containers[0].Id);
            }
            const target = `openwa-${service}`;
            const allContainers = await this.docker.listContainers({ all: true });
            const match = allContainers.find(c => c.Names?.some(n => n === target || n === `/${target}`));
            if (match) {
                return this.docker.getContainer(match.Id);
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Failed to get container for service: ${service}`, error);
            return null;
        }
    }
    getContainerSpec(profile) {
        const specs = {
            redis: {
                image: 'redis:7-alpine',
                name: 'openwa-redis',
                alias: 'redis',
                cmd: ['redis-server', '--appendonly', 'yes'],
                volumes: [{ name: 'openwa_redis-data', path: '/data' }],
                healthcheck: {
                    test: ['CMD', 'redis-cli', 'ping'],
                    interval: 5000000000,
                    timeout: 3000000000,
                    retries: 5,
                },
                labels: {
                    'com.openwa.service': 'cache',
                    'com.openwa.builtin': 'true',
                },
            },
            postgres: {
                image: 'postgres:16-alpine',
                name: 'openwa-postgres',
                alias: 'postgres',
                env: ['POSTGRES_USER=openwa', 'POSTGRES_PASSWORD=openwa', 'POSTGRES_DB=openwa'],
                volumes: [{ name: 'openwa_postgres-data', path: '/var/lib/postgresql/data' }],
                healthcheck: {
                    test: ['CMD-SHELL', 'pg_isready -U openwa'],
                    interval: 5000000000,
                    timeout: 3000000000,
                    retries: 5,
                },
                labels: {
                    'com.openwa.service': 'database',
                    'com.openwa.builtin': 'true',
                },
            },
            minio: {
                image: 'minio/minio',
                name: 'openwa-minio',
                alias: 'minio',
                cmd: ['server', '/data', '--console-address', ':9001'],
                env: [
                    `MINIO_ROOT_USER=${process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'minioadmin'}`,
                    `MINIO_ROOT_PASSWORD=${process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'minioadmin'}`,
                ],
                volumes: [{ name: 'openwa_minio-data', path: '/data' }],
                ports: [
                    { container: 9000, host: 9000 },
                    { container: 9001, host: 9001 },
                ],
                healthcheck: {
                    test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live'],
                    interval: 10000000000,
                    timeout: 5000000000,
                    retries: 3,
                },
                labels: {
                    'com.openwa.service': 'storage',
                    'com.openwa.builtin': 'true',
                },
            },
        };
        return specs[profile] || null;
    }
    async createService(profile) {
        if (!this.docker || !this.isAvailable) {
            this.logger.error('Docker not available for creating service');
            return false;
        }
        const spec = this.getContainerSpec(profile);
        if (!spec) {
            this.logger.error(`Unknown profile: ${profile}`);
            return false;
        }
        this.logger.log(`Creating service: ${profile} (image: ${spec.image})`);
        try {
            const existing = await this.getContainerByService(profile);
            if (existing) {
                const info = await existing.inspect();
                if (info.State.Running) {
                    this.logger.log(`Container ${spec.name} already running`);
                    return true;
                }
                await existing.start();
                this.logger.log(`Started existing container: ${spec.name}`);
                return true;
            }
            this.logger.log(`Pulling image: ${spec.image}`);
            await new Promise((resolve, reject) => {
                void this.docker.pull(spec.image, (err, stream) => {
                    if (err)
                        return reject(err);
                    this.docker.modem.followProgress(stream, (err2) => {
                        if (err2)
                            return reject(err2);
                        resolve();
                    });
                });
            });
            if (spec.volumes) {
                for (const vol of spec.volumes) {
                    try {
                        await this.docker.createVolume({ Name: vol.name });
                        this.logger.log(`Created volume: ${vol.name}`);
                    }
                    catch (error) {
                        this.logger.debug(`Volume ${vol.name} creation skipped (may already exist)`, { error: String(error) });
                    }
                }
            }
            const containerConfig = {
                name: spec.name,
                Image: spec.image,
                Cmd: spec.cmd,
                Env: spec.env,
                Labels: spec.labels,
                HostConfig: {
                    NetworkMode: 'openwa-network',
                    RestartPolicy: { Name: 'unless-stopped' },
                    Binds: spec.volumes?.map(v => `${v.name}:${v.path}`),
                    PortBindings: spec.ports?.reduce((acc, p) => {
                        acc[`${p.container}/tcp`] = [{ HostIp: '127.0.0.1', HostPort: p.host.toString() }];
                        return acc;
                    }, {}),
                },
                Healthcheck: spec.healthcheck
                    ? {
                        Test: spec.healthcheck.test,
                        Interval: spec.healthcheck.interval,
                        Timeout: spec.healthcheck.timeout,
                        Retries: spec.healthcheck.retries,
                    }
                    : undefined,
                NetworkingConfig: {
                    EndpointsConfig: {
                        'openwa-network': {
                            Aliases: [spec.alias, profile],
                        },
                    },
                },
            };
            const container = await this.docker.createContainer(containerConfig);
            await container.start();
            this.logger.log(`Created and started container: ${spec.name}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to create service ${profile}: ${error instanceof Error ? error.message : error}`);
            return false;
        }
    }
    async startService(service) {
        const container = await this.getContainerByService(service);
        if (!container) {
            this.logger.log(`Container for service '${service}' not found, creating...`);
            const serviceToProfile = {
                database: 'postgres',
                cache: 'redis',
                storage: 'minio',
                postgres: 'postgres',
                redis: 'redis',
                minio: 'minio',
            };
            const profile = serviceToProfile[service] || service;
            return this.createService(profile);
        }
        try {
            const info = await container.inspect();
            if (info.State.Running) {
                this.logger.log(`Service '${service}' is already running`);
                return true;
            }
            await container.start();
            this.logger.log(`Started service: ${service}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to start service: ${service}`, error);
            return false;
        }
    }
    async removeService(profile) {
        this.logger.log(`Removing service with profile: ${profile}`);
        const serviceMap = {
            postgres: 'database',
            redis: 'cache',
            minio: 'storage',
        };
        const service = serviceMap[profile] || profile;
        const container = await this.getContainerByService(service);
        if (container) {
            try {
                const info = await container.inspect();
                if (info.State.Running) {
                    await container.stop();
                    this.logger.log(`Stopped container: ${profile}`);
                }
                await container.remove({ v: true });
                this.logger.log(`Removed container: ${profile}`);
                return true;
            }
            catch (error) {
                this.logger.error(`Failed to remove container: ${error instanceof Error ? error.message : error}`);
                return false;
            }
        }
        this.logger.log(`Container for service '${profile}' not found, nothing to remove`);
        return true;
    }
    async stopService(service) {
        const container = await this.getContainerByService(service);
        if (!container) {
            this.logger.warn(`Container for service '${service}' not found`);
            return true;
        }
        try {
            const info = await container.inspect();
            if (!info.State.Running) {
                this.logger.log(`Service '${service}' is already stopped`);
                return true;
            }
            await container.stop();
            this.logger.log(`Stopped service: ${service}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to stop service: ${service}`, error);
            return false;
        }
    }
    async orchestrateProfiles(profiles) {
        let estimatedTime = 15;
        if (profiles.includes('postgres'))
            estimatedTime += 20;
        if (profiles.includes('redis'))
            estimatedTime += 13;
        if (profiles.includes('minio'))
            estimatedTime += 15;
        const result = {
            success: true,
            message: '',
            containersStarted: [],
            containersStopped: [],
            containersRemoved: [],
            errors: [],
            estimatedTime,
        };
        if (!this.docker || !this.isAvailable) {
            result.success = false;
            result.message = 'Docker is not available';
            return result;
        }
        this.logger.log(`Orchestrating profiles: ${profiles.join(', ')}`);
        const profileToService = {
            postgres: 'database',
            redis: 'cache',
            minio: 'storage',
        };
        for (const profile of profiles) {
            const service = profileToService[profile] || profile;
            try {
                const started = await this.startService(service);
                if (started) {
                    result.containersStarted.push(profile);
                }
                else {
                    result.errors.push(`Service '${profile}' container not found. It may need to be created first with docker-compose.`);
                }
            }
            catch (error) {
                result.errors.push(`Failed to start ${profile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        if (result.errors.length > 0) {
            result.success = profiles.length > 0 && result.containersStarted.length > 0;
            result.message = result.errors.join('; ');
        }
        else {
            result.message = `Successfully orchestrated ${result.containersStarted.length} service(s)`;
        }
        return result;
    }
    async getSystemInfo() {
        if (!this.docker || !this.isAvailable) {
            return { available: false };
        }
        try {
            const info = (await this.docker.info());
            return {
                available: true,
                info: {
                    containers: info.Containers,
                    containersRunning: info.ContainersRunning,
                    containersPaused: info.ContainersPaused,
                    containersStopped: info.ContainersStopped,
                    images: info.Images,
                    serverVersion: info.ServerVersion,
                    operatingSystem: info.OperatingSystem,
                    architecture: info.Architecture,
                },
            };
        }
        catch (error) {
            this.logger.error('Failed to get Docker info', error);
            return { available: false };
        }
    }
};
exports.DockerService = DockerService;
exports.DockerService = DockerService = DockerService_1 = __decorate([
    (0, common_1.Injectable)()
], DockerService);
//# sourceMappingURL=docker.service.js.map