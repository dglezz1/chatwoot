"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionTools = sessionTools;
const zod_1 = require("zod");
const api_key_entity_1 = require("../../../modules/auth/entities/api-key.entity");
const session_response_dto_1 = require("../../../modules/session/dto/session-response.dto");
const sessionId = zod_1.z.string().min(1).describe('Session UUID (the session id, not the name)');
function sessionTools(session) {
    return [
        {
            name: 'SessionFindAll',
            description: 'List the WhatsApp sessions this API key may access (id, name, status). Use to discover available sessions before calling session-scoped tools. Supports limit/offset paging.',
            tier: 'read',
            inputSchema: zod_1.z.object({
                limit: zod_1.z.number().int().min(1).max(1000).optional(),
                offset: zod_1.z.number().int().min(0).optional(),
            }),
            handler: (input, apiKey) => session
                .findAll(apiKey.allowedSessions, { limit: input.limit, offset: input.offset })
                .then(ss => ss.map(s => session_response_dto_1.SessionResponseDto.fromEntity(s))),
        },
        {
            name: 'SessionFindOne',
            description: 'Get one session by its UUID, including connection status and phone number.',
            tier: 'read',
            sessionScoped: true,
            inputSchema: zod_1.z.object({ sessionId }),
            handler: (input) => session.findOne(input.sessionId).then(s => session_response_dto_1.SessionResponseDto.fromEntity(s)),
        },
        {
            name: 'SessionGetChats',
            description: 'List recent chats for a session (most recent first). Use limit/offset to page through large lists.',
            tier: 'read',
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                limit: zod_1.z.number().int().min(1).max(1000).optional(),
                offset: zod_1.z.number().int().min(0).optional(),
            }),
            handler: (input) => session.getChats(input.sessionId, { limit: input.limit, offset: input.offset }),
        },
        {
            name: 'SessionGetStats',
            description: 'Aggregate session counts (total, active, ready, disconnected) the key is allowed to see.',
            tier: 'read',
            inputSchema: zod_1.z.object({}),
            handler: (_input, apiKey) => session.getStats(apiKey.allowedSessions),
        },
        {
            name: 'SessionMarkChatRead',
            description: 'Mark a chat as read (clears unread count). Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID (e.g. 1234567890@c.us)'),
            }),
            handler: (input) => session.sendSeen(input.sessionId, input.chatId).then(success => ({ success })),
        },
        {
            name: 'SessionMarkChatUnread',
            description: 'Mark a chat as unread. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID (e.g. 1234567890@c.us)'),
            }),
            handler: (input) => session.markUnread(input.sessionId, input.chatId).then(success => ({ success })),
        },
        {
            name: 'SessionSendChatState',
            description: "Show a typing/recording indicator in a chat, or clear it with 'paused'. Requires OPERATOR role.",
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID (e.g. 1234567890@c.us)'),
                state: zod_1.z
                    .enum(['typing', 'recording', 'paused'])
                    .describe("'typing' or 'recording' shows the indicator; 'paused' clears it"),
            }),
            handler: (input) => session.sendChatState(input.sessionId, input.chatId, input.state).then(() => ({ success: true })),
        },
    ];
}
//# sourceMappingURL=session.tools.js.map