"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invokeTool = invokeTool;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
async function invokeTool(tool, rawInput, rawKey, authService, onAuthenticated) {
    if (!rawKey) {
        throw new common_1.UnauthorizedException('Missing API key');
    }
    const probe = (rawInput ?? {});
    const sessionId = tool.sessionScoped && typeof probe.sessionId === 'string' ? probe.sessionId : undefined;
    if (tool.sessionScoped && !sessionId) {
        throw new common_1.BadRequestException('sessionId is required for this tool');
    }
    const apiKey = await authService.validateApiKey(rawKey, undefined, sessionId);
    onAuthenticated?.(apiKey.id);
    if (tool.requiredRole && !authService.hasPermission(apiKey, tool.requiredRole)) {
        throw new common_1.ForbiddenException('API key lacks the required role');
    }
    let input;
    try {
        input = tool.inputSchema.parse(rawInput);
    }
    catch (e) {
        if (e instanceof zod_1.ZodError) {
            throw new common_1.BadRequestException(e.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`));
        }
        throw e;
    }
    return tool.handler(input, apiKey);
}
//# sourceMappingURL=tool-invoker.js.map