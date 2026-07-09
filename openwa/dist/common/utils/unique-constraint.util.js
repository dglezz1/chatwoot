"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUniqueConstraintError = isUniqueConstraintError;
function isUniqueConstraintError(err) {
    if (err == null || typeof err !== 'object')
        return false;
    const e = err;
    const code = e.driverError?.code ?? e.code;
    const message = e.driverError?.message ?? e.message ?? '';
    if (code === '23505')
        return true;
    if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT'))
        return true;
    if (code != null)
        return false;
    return /UNIQUE constraint failed/i.test(message);
}
//# sourceMappingURL=unique-constraint.util.js.map