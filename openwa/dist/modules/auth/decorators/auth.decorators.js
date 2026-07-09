"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentApiKey = exports.Public = exports.SessionScoped = exports.RequireRole = exports.SESSION_SCOPED_KEY = exports.PUBLIC_KEY = exports.REQUIRED_ROLE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRED_ROLE_KEY = 'requiredRole';
exports.PUBLIC_KEY = 'isPublic';
exports.SESSION_SCOPED_KEY = 'sessionScoped';
const RequireRole = (role) => (0, common_1.SetMetadata)(exports.REQUIRED_ROLE_KEY, role);
exports.RequireRole = RequireRole;
const SessionScoped = () => (0, common_1.SetMetadata)(exports.SESSION_SCOPED_KEY, true);
exports.SessionScoped = SessionScoped;
const Public = () => (0, common_1.SetMetadata)(exports.PUBLIC_KEY, true);
exports.Public = Public;
exports.CurrentApiKey = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.apiKey;
});
//# sourceMappingURL=auth.decorators.js.map