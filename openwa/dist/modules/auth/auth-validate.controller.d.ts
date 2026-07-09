import { ApiKey } from './entities/api-key.entity';
export declare class AuthValidateController {
    validate(apiKey?: ApiKey): {
        valid: boolean;
        role?: string;
    };
}
