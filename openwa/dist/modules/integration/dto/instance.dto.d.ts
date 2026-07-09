import { IngressUrl } from '../ingress-url';
export declare class CreateInstanceDto {
    instanceId: string;
    sessionScope?: string;
    verifyToken?: string;
    secret?: string;
    config?: Record<string, unknown>;
}
export declare class UpdateInstanceDto {
    enabled?: boolean;
    sessionScope?: string;
    config?: Record<string, unknown>;
}
export declare class InstanceView {
    id: string;
    pluginId: string;
    instanceId: string;
    sessionScope: string | null;
    secret: string;
    verifyToken: string | null;
    config: Record<string, unknown> | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    ingressUrls: IngressUrl[];
}
export type MintedInstance = InstanceView;
