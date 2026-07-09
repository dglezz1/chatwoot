"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageTools = messageTools;
const zod_1 = require("zod");
const api_key_entity_1 = require("../../../modules/auth/entities/api-key.entity");
const sessionId = zod_1.z.string().min(1).describe('Session UUID (the session id, not the name)');
function messageTools(message) {
    return [
        {
            name: 'MessageList',
            description: 'List persisted messages for a session, optionally filtered by chatId or sender. Reads from the local DB.',
            tier: 'read',
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().optional().describe('Filter to a specific chat JID'),
                from: zod_1.z.string().optional().describe('Filter by sender phone or JID'),
                limit: zod_1.z.number().int().min(1).max(100).optional(),
                offset: zod_1.z.number().int().min(0).optional(),
            }),
            handler: (input) => message.getMessages(input.sessionId, {
                chatId: input.chatId,
                from: input.from,
                limit: input.limit,
                offset: input.offset,
            }),
        },
        {
            name: 'MessageHistory',
            description: 'Fetch live chat history from WhatsApp for a specific chat. Bypasses the local DB — useful for messages that arrived before the gateway started.',
            tier: 'read',
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID (e.g. 1234567890@c.us or groupId@g.us)'),
                limit: zod_1.z
                    .number()
                    .int()
                    .min(1)
                    .max(2000)
                    .optional()
                    .describe('Number of messages to fetch; without deep:true the engine caps at 100'),
                includeMedia: zod_1.z.boolean().optional().describe('Download media as base64 (slower)'),
                deep: zod_1.z.boolean().optional().describe('Raise limit ceiling to 2000 for reaching further back in history'),
            }),
            handler: (input) => message.getChatHistory(input.sessionId, input.chatId, input.limit, input.includeMedia, input.deep),
        },
        {
            name: 'MessageGetReactions',
            description: 'Get reactions for a specific message, including which contacts sent which emoji.',
            tier: 'read',
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID containing the message'),
                messageId: zod_1.z.string().describe('Message ID to get reactions for'),
            }),
            handler: (input) => message.getMessageReactions(input.sessionId, input.chatId, input.messageId),
        },
        {
            name: 'MessageSendText',
            description: 'Send a plain text message to a chat or group. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID (e.g. 628123456789@c.us or groupId@g.us)'),
                text: zod_1.z.string().min(1).max(4096).describe('Text message content'),
            }),
            handler: (input) => message.sendText(input.sessionId, { chatId: input.chatId, text: input.text }),
        },
        {
            name: 'MessageSendImage',
            description: 'Send an image message via URL or base64. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                url: zod_1.z.string().url().optional().describe('Image URL (http/https)'),
                base64: zod_1.z.string().optional().describe('Base64-encoded image data'),
                mimetype: zod_1.z.string().optional().describe('MIME type (required when using base64)'),
                filename: zod_1.z.string().max(255).optional(),
                caption: zod_1.z.string().max(1024).optional(),
            }),
            handler: (input) => message.sendImage(input.sessionId, {
                chatId: input.chatId,
                url: input.url,
                base64: input.base64,
                mimetype: input.mimetype,
                filename: input.filename,
                caption: input.caption,
            }),
        },
        {
            name: 'MessageSendVideo',
            description: 'Send a video message via URL or base64. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                url: zod_1.z.string().url().optional().describe('Video URL (http/https)'),
                base64: zod_1.z.string().optional().describe('Base64-encoded video data'),
                mimetype: zod_1.z.string().optional().describe('MIME type (required when using base64)'),
                filename: zod_1.z.string().max(255).optional(),
                caption: zod_1.z.string().max(1024).optional(),
            }),
            handler: (input) => message.sendVideo(input.sessionId, {
                chatId: input.chatId,
                url: input.url,
                base64: input.base64,
                mimetype: input.mimetype,
                filename: input.filename,
                caption: input.caption,
            }),
        },
        {
            name: 'MessageSendAudio',
            description: 'Send an audio/voice message via URL or base64. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                url: zod_1.z.string().url().optional().describe('Audio URL (http/https)'),
                base64: zod_1.z.string().optional().describe('Base64-encoded audio data'),
                mimetype: zod_1.z.string().optional().describe('MIME type (required when using base64)'),
                filename: zod_1.z.string().max(255).optional(),
                caption: zod_1.z.string().max(1024).optional(),
                ptt: zod_1.z.boolean().optional().describe('Send as a WhatsApp voice note (PTT)'),
            }),
            handler: (input) => message.sendAudio(input.sessionId, {
                chatId: input.chatId,
                url: input.url,
                base64: input.base64,
                mimetype: input.mimetype,
                filename: input.filename,
                caption: input.caption,
                ptt: input.ptt,
            }),
        },
        {
            name: 'MessageSendDocument',
            description: 'Send a document/file message via URL or base64. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                url: zod_1.z.string().url().optional().describe('Document URL (http/https)'),
                base64: zod_1.z.string().optional().describe('Base64-encoded document data'),
                mimetype: zod_1.z.string().optional().describe('MIME type (required when using base64)'),
                filename: zod_1.z.string().max(255).optional(),
                caption: zod_1.z.string().max(1024).optional(),
            }),
            handler: (input) => message.sendDocument(input.sessionId, {
                chatId: input.chatId,
                url: input.url,
                base64: input.base64,
                mimetype: input.mimetype,
                filename: input.filename,
                caption: input.caption,
            }),
        },
        {
            name: 'MessageSendLocation',
            description: 'Send a location pin message. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                latitude: zod_1.z.number().min(-90).max(90).describe('Latitude coordinate'),
                longitude: zod_1.z.number().min(-180).max(180).describe('Longitude coordinate'),
                description: zod_1.z.string().optional().describe('Location label/description'),
                address: zod_1.z.string().optional().describe('Street address'),
            }),
            handler: (input) => message.sendLocation(input.sessionId, {
                chatId: input.chatId,
                latitude: input.latitude,
                longitude: input.longitude,
                description: input.description,
                address: input.address,
            }),
        },
        {
            name: 'MessageSendContact',
            description: 'Send a contact card message. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                contactName: zod_1.z.string().min(1).describe('Display name of the contact to share'),
                contactNumber: zod_1.z.string().min(1).describe('Phone number of the contact to share'),
            }),
            handler: (input) => message.sendContact(input.sessionId, {
                chatId: input.chatId,
                contactName: input.contactName,
                contactNumber: input.contactNumber,
            }),
        },
        {
            name: 'MessageSendSticker',
            description: 'Send a sticker message via URL or base64. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                url: zod_1.z.string().url().optional().describe('Sticker URL (http/https)'),
                base64: zod_1.z.string().optional().describe('Base64-encoded sticker data'),
                mimetype: zod_1.z.string().optional().describe('MIME type (required when using base64)'),
                filename: zod_1.z.string().max(255).optional(),
                caption: zod_1.z.string().max(1024).optional(),
            }),
            handler: (input) => message.sendSticker(input.sessionId, {
                chatId: input.chatId,
                url: input.url,
                base64: input.base64,
                mimetype: input.mimetype,
                filename: input.filename,
                caption: input.caption,
            }),
        },
        {
            name: 'MessageSendTemplate',
            description: 'Render a stored text template and send it as a text message. Provide either templateId or templateName. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                templateId: zod_1.z.string().optional().describe('Template UUID'),
                templateName: zod_1.z.string().optional().describe('Template name slug'),
                vars: zod_1.z
                    .record(zod_1.z.string(), zod_1.z.string())
                    .optional()
                    .describe('Variables to substitute into {{placeholder}} tokens'),
            }),
            handler: (input) => message.sendTemplate(input.sessionId, {
                chatId: input.chatId,
                templateId: input.templateId,
                templateName: input.templateName,
                vars: input.vars,
            }),
        },
        {
            name: 'MessageReply',
            description: 'Reply to a specific message (quoted reply). Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID'),
                quotedMessageId: zod_1.z.string().describe('ID of the message to quote/reply to'),
                text: zod_1.z.string().min(1).describe('Reply text content'),
            }),
            handler: (input) => message.reply(input.sessionId, {
                chatId: input.chatId,
                quotedMessageId: input.quotedMessageId,
                text: input.text,
            }),
        },
        {
            name: 'MessageForward',
            description: 'Forward a message from one chat to another. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                fromChatId: zod_1.z.string().describe('Source chat JID'),
                toChatId: zod_1.z.string().describe('Destination chat JID'),
                messageId: zod_1.z.string().describe('ID of the message to forward'),
            }),
            handler: (input) => message.forward(input.sessionId, {
                fromChatId: input.fromChatId,
                toChatId: input.toChatId,
                messageId: input.messageId,
            }),
        },
        {
            name: 'MessageReact',
            description: 'Add or remove a reaction emoji on a message. Send empty string emoji to remove. Requires OPERATOR role.',
            tier: 'write',
            requiredRole: api_key_entity_1.ApiKeyRole.OPERATOR,
            sessionScoped: true,
            inputSchema: zod_1.z.object({
                sessionId,
                chatId: zod_1.z.string().describe('Chat JID containing the message'),
                messageId: zod_1.z.string().describe('ID of the message to react to'),
                emoji: zod_1.z.string().describe('Emoji to react with. Empty string removes the reaction.'),
            }),
            handler: (input) => message
                .reactToMessage(input.sessionId, { chatId: input.chatId, messageId: input.messageId, emoji: input.emoji })
                .then(() => ({ success: true })),
        },
    ];
}
//# sourceMappingURL=message.tools.js.map