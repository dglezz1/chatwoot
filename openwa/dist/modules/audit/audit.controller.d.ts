import { AuditService } from './audit.service';
import { AuditLog, AuditAction, AuditSeverity } from './entities/audit-log.entity';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    findAll(action?: AuditAction, severity?: AuditSeverity, sessionId?: string, apiKeyId?: string, limit?: string, offset?: string): Promise<{
        data: AuditLog[];
        total: number;
    }>;
}
