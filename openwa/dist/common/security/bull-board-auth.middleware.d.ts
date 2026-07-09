import { NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
export declare class BullBoardAuthMiddleware implements NestMiddleware {
    private readonly authService;
    private readonly configService;
    constructor(authService: AuthService, configService: ConfigService);
    use(req: Request, _res: Response, next: NextFunction): Promise<void>;
    private extractKey;
    private getClientIp;
}
