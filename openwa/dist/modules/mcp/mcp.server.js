"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIpThrottle = createIpThrottle;
exports.resolveMcpReadOnly = resolveMcpReadOnly;
exports.mountMcpServer = mountMcpServer;
const common_1 = require("@nestjs/common");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const tool_invoker_1 = require("../../core/agent-tools/tool-invoker");
const tool_result_1 = require("./tool-result");
const ip_1 = require("../../common/utils/ip");
const logger = new common_1.Logger('McpServer');
function extractApiKey(extra) {
    const headers = extra.requestInfo?.headers ?? {};
    const xApiKey = headers['x-api-key'];
    if (xApiKey) {
        return Array.isArray(xApiKey) ? xApiKey[0] : xApiKey;
    }
    const auth = headers['authorization'];
    const authStr = Array.isArray(auth) ? auth[0] : auth;
    if (authStr?.toLowerCase().startsWith('bearer ')) {
        return authStr.slice(7).trim();
    }
    return undefined;
}
function buildServer(registry, authService, rateLimiter, readOnly, serverInfo) {
    const server = new mcp_js_1.McpServer({ name: serverInfo.name, version: serverInfo.version }, { capabilities: { tools: {}, logging: {} } });
    const tools = registry.list({ readOnly });
    for (const tool of tools) {
        server.registerTool(tool.name, {
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
                readOnlyHint: tool.tier === 'read',
                destructiveHint: tool.destructive ?? false,
                idempotentHint: tool.idempotent ?? tool.tier === 'read',
            },
        }, async (input, extra) => {
            const rawKey = extractApiKey(extra);
            try {
                const result = await (0, tool_invoker_1.invokeTool)(tool, input, rawKey, authService, id => rateLimiter.check(id));
                return tool.resultDisposition === 'json'
                    ? (0, tool_result_1.jsonToolResult)(result)
                    : (0, tool_result_1.smartToolResult)(result);
            }
            catch (error) {
                return (0, tool_result_1.handleToolError)(error);
            }
        });
    }
    logger.log(`MCP server built with ${tools.length} tools (readOnly=${readOnly})`);
    return server;
}
function createIpThrottle(ipRateLimiter) {
    return (req, res, next) => {
        const trustedProxies = (process.env.TRUSTED_PROXIES ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        const ip = (0, ip_1.resolveClientIp)(req, trustedProxies);
        try {
            ipRateLimiter.check(ip);
            next();
        }
        catch (err) {
            const status = err instanceof common_1.HttpException ? err.getStatus() : 429;
            res.status(status).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: err instanceof Error ? err.message : 'MCP rate limit exceeded' },
                id: null,
            });
        }
    };
}
function resolveMcpReadOnly(optionsReadOnly) {
    return optionsReadOnly ?? process.env.MCP_READONLY !== 'false';
}
function mountMcpServer(httpAdapter, registry, authService, rateLimiter, ipRateLimiter, options = {}) {
    const basePath = (options.basePath ?? '/mcp').replace(/\/$/, '') || '/mcp';
    const serverInfo = options.serverInfo ?? { name: 'openwa', version: '0.0.0' };
    const readOnly = resolveMcpReadOnly(options.readOnly);
    const tools = registry.list({ readOnly });
    logger.log(`MCP server mounted at POST ${basePath} (${tools.length} tools)`);
    const handler = async (req, res) => {
        const server = buildServer(registry, authService, rateLimiter, readOnly, serverInfo);
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        try {
            res.on('close', () => {
                void transport.close();
                void server.close();
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            logger.error('Error handling MCP request', error instanceof Error ? error.stack : String(error));
            if (!res.headersSent) {
                res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
            }
        }
    };
    const adapter = httpAdapter;
    adapter.post(basePath, createIpThrottle(ipRateLimiter), express_1.default.json(), handler);
}
//# sourceMappingURL=mcp.server.js.map