export declare enum AuditAction {
    API_KEY_CREATED = "api_key_created",
    API_KEY_USED = "api_key_used",
    API_KEY_REVOKED = "api_key_revoked",
    API_KEY_DELETED = "api_key_deleted",
    API_KEY_AUTH_FAILED = "api_key_auth_failed",
    SESSION_CREATED = "session_created",
    SESSION_STARTED = "session_started",
    SESSION_STOPPED = "session_stopped",
    SESSION_FORCE_KILLED = "session_force_killed",
    SESSION_DELETED = "session_deleted",
    SESSION_QR_GENERATED = "session_qr_generated",
    SESSION_CONNECTED = "session_connected",
    SESSION_DISCONNECTED = "session_disconnected",
    MESSAGE_SENT = "message_sent",
    MESSAGE_FAILED = "message_failed",
    WEBHOOK_CREATED = "webhook_created",
    WEBHOOK_DELETED = "webhook_deleted",
    WEBHOOK_TRIGGERED = "webhook_triggered",
    WEBHOOK_FAILED = "webhook_failed",
    INTEGRATION_INSTANCE_CREATED = "integration_instance_created",
    INTEGRATION_INSTANCE_UPDATED = "integration_instance_updated",
    INTEGRATION_INSTANCE_SECRET_REGENERATED = "integration_instance_secret_regenerated",
    INTEGRATION_INSTANCE_DELETED = "integration_instance_deleted"
}
export declare enum AuditSeverity {
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export declare class AuditLog {
    id: string;
    action: AuditAction;
    severity: AuditSeverity;
    apiKeyId: string | null;
    apiKeyName: string | null;
    sessionId: string | null;
    sessionName: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    method: string | null;
    path: string | null;
    statusCode: number | null;
    metadata: Record<string, unknown> | null;
    errorMessage: string | null;
    createdAt: Date;
}
