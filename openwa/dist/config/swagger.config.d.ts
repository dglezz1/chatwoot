import { OpenAPIObject } from '@nestjs/swagger';
export declare const API_KEY_SECURITY_SCHEME = "X-API-Key";
export declare const PUBLIC_PATHS: string[];
export declare function exemptPublicOperations(document: OpenAPIObject): OpenAPIObject;
export declare function createSwaggerConfig(): Omit<OpenAPIObject, 'paths'>;
