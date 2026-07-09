import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { AuditService } from '../../audit/audit.service';
export declare class ApiKeyGuard implements CanActivate {
    private readonly authService;
    private readonly reflector;
    private readonly configService;
    private readonly auditService;
    constructor(authService: AuthService, reflector: Reflector, configService: ConfigService, auditService: AuditService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private authorize;
    private extractApiKey;
    private getClientIp;
}
