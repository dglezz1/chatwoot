"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_PATHS = exports.API_KEY_SECURITY_SCHEME = void 0;
exports.exemptPublicOperations = exemptPublicOperations;
exports.createSwaggerConfig = createSwaggerConfig;
const swagger_1 = require("@nestjs/swagger");
exports.API_KEY_SECURITY_SCHEME = 'X-API-Key';
exports.PUBLIC_PATHS = [
    '/api/health',
    '/api/health/live',
    '/api/health/ready',
    '/api/infra/health',
    '/api/ingress/{pluginId}/{instanceId}/{path}',
];
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace', 'search'];
function exemptPublicOperations(document) {
    for (const path of exports.PUBLIC_PATHS) {
        const item = document.paths?.[path];
        if (!item)
            continue;
        for (const method of HTTP_METHODS) {
            const op = item[method];
            if (op)
                op.security = [];
        }
    }
    return document;
}
function createSwaggerConfig() {
    const { version } = require('../../package.json');
    return (new swagger_1.DocumentBuilder()
        .setTitle('OpenWA API')
        .setDescription('Open Source WhatsApp API Gateway - Free, Self-Hosted HTTP API')
        .setVersion(version)
        .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, exports.API_KEY_SECURITY_SCHEME)
        .addSecurityRequirements(exports.API_KEY_SECURITY_SCHEME)
        .setContact('OpenWA', 'https://github.com/rmyndharis/OpenWA', 'yudhi@rmyndharis.com')
        .addTag('sessions', 'WhatsApp session management')
        .addTag('messages', 'Send and manage messages')
        .addTag('webhooks', 'Webhook configuration')
        .addTag('contacts', 'Contact management')
        .addTag('groups', 'Group management')
        .addTag('labels', 'Label management (WhatsApp Business)')
        .addTag('channels', 'Channel/Newsletter management')
        .addTag('catalog', 'Product catalog (WhatsApp Business)')
        .addTag('status', 'Status/Stories')
        .addTag('statistics', 'Usage statistics')
        .addTag('templates', 'Message templates')
        .addTag('plugins', 'Plugin management')
        .addTag('settings', 'Application settings')
        .addTag('infrastructure', 'Infrastructure & datastore management')
        .addTag('integration', 'Integration Fabric (provider webhooks & instances)')
        .addTag('auth', 'API key management')
        .addTag('audit', 'Audit log')
        .addTag('metrics', 'Prometheus metrics')
        .addTag('health', 'Health check endpoints')
        .build());
}
//# sourceMappingURL=swagger.config.js.map