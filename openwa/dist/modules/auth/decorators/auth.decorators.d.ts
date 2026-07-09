import { ApiKeyRole } from '../entities/api-key.entity';
export declare const REQUIRED_ROLE_KEY = "requiredRole";
export declare const PUBLIC_KEY = "isPublic";
export declare const SESSION_SCOPED_KEY = "sessionScoped";
export declare const RequireRole: (role: ApiKeyRole) => import("@nestjs/common").CustomDecorator<string>;
export declare const SessionScoped: () => import("@nestjs/common").CustomDecorator<string>;
export declare const Public: () => import("@nestjs/common").CustomDecorator<string>;
export declare const CurrentApiKey: (...dataOrPipes: unknown[]) => ParameterDecorator;
