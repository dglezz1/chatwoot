import type { AuthService } from '../../modules/auth/auth.service';
import type { ToolDescriptor } from './tool-descriptor';
export declare function invokeTool(tool: ToolDescriptor, rawInput: unknown, rawKey: string | undefined, authService: AuthService, onAuthenticated?: (apiKeyId: string) => void): Promise<unknown>;
