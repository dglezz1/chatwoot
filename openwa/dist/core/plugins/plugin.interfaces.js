"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginCapabilityError = exports.SUPPORTED_SDK_MAJOR = exports.PluginCapabilityPermission = exports.PluginStatus = exports.PluginType = void 0;
exports.validateIngressManifest = validateIngressManifest;
var PluginType;
(function (PluginType) {
    PluginType["ENGINE"] = "engine";
    PluginType["STORAGE"] = "storage";
    PluginType["QUEUE"] = "queue";
    PluginType["AUTH"] = "auth";
    PluginType["EXTENSION"] = "extension";
})(PluginType || (exports.PluginType = PluginType = {}));
var PluginStatus;
(function (PluginStatus) {
    PluginStatus["INSTALLED"] = "installed";
    PluginStatus["ENABLED"] = "enabled";
    PluginStatus["DISABLED"] = "disabled";
    PluginStatus["ERROR"] = "error";
})(PluginStatus || (exports.PluginStatus = PluginStatus = {}));
exports.PluginCapabilityPermission = {
    MESSAGES_SEND: 'messages:send',
    ENGINE_READ: 'engine:read',
    NET_FETCH: 'net:fetch',
    WEBHOOK_INGRESS: 'webhook:ingress',
    CONVERSATION_SEND: 'conversation:send',
};
exports.SUPPORTED_SDK_MAJOR = 1;
function validateIngressManifest(manifest) {
    if (!manifest.ingress?.length)
        return;
    const declaredMajor = Number.parseInt((manifest.sdkVersion ?? '1').split('.')[0], 10);
    if (!Number.isFinite(declaredMajor) || declaredMajor !== exports.SUPPORTED_SDK_MAJOR) {
        throw new Error(`Plugin ${manifest.id}: SDK major ${manifest.sdkVersion} is not supported by this host (supports ${exports.SUPPORTED_SDK_MAJOR})`);
    }
    const perms = manifest.permissions ?? [];
    if (!perms.includes(exports.PluginCapabilityPermission.WEBHOOK_INGRESS)) {
        throw new Error(`Plugin ${manifest.id}: declares ingress routes but is missing the 'webhook:ingress' permission`);
    }
    const seen = new Set();
    for (const r of manifest.ingress) {
        if (!r.route || seen.has(r.route)) {
            throw new Error(`Plugin ${manifest.id}: duplicate or empty ingress route '${r.route}'`);
        }
        seen.add(r.route);
        if (r.signature.toleranceSec !== undefined && r.signature.toleranceSec <= 0) {
            throw new Error(`Plugin ${manifest.id}: route '${r.route}' toleranceSec must be > 0 (a replay guard would be a no-op)`);
        }
    }
}
class PluginCapabilityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PluginCapabilityError';
    }
}
exports.PluginCapabilityError = PluginCapabilityError;
//# sourceMappingURL=plugin.interfaces.js.map