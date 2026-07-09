"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WA_VERSION_REGISTRY_URL = void 0;
exports.__resetWebVersionCache = __resetWebVersionCache;
exports.resolveCurrentWebVersion = resolveCurrentWebVersion;
exports.resolveWebVersionPin = resolveWebVersionPin;
exports.getEffectiveWebVersionInfo = getEffectiveWebVersionInfo;
exports.WA_VERSION_REGISTRY_URL = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json';
const DEFAULT_REMOTE_TEMPLATE = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';
const FAILURE_BACKOFF_MS = 60_000;
let cachedCurrentVersion;
let inFlight = null;
let lastFailureAt = 0;
function __resetWebVersionCache() {
    cachedCurrentVersion = undefined;
    inFlight = null;
    lastFailureAt = 0;
}
function buildRemotePin(version) {
    const template = process.env.WWEBJS_WEB_VERSION_REMOTE_PATH?.trim() || DEFAULT_REMOTE_TEMPLATE;
    return {
        webVersion: version,
        webVersionCache: { type: 'remote', remotePath: template.replace('{version}', version) },
    };
}
async function resolveCurrentWebVersion(fetcher = fetch) {
    if (typeof cachedCurrentVersion === 'string')
        return cachedCurrentVersion;
    if (inFlight)
        return inFlight;
    if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS)
        return null;
    inFlight = (async () => {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetcher(exports.WA_VERSION_REGISTRY_URL, { signal: controller.signal });
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const json = (await res.json());
                const v = json.currentVersion;
                if (typeof v === 'string' && /^\d/.test(v)) {
                    cachedCurrentVersion = v;
                    return v;
                }
                lastFailureAt = Date.now();
                return null;
            }
            finally {
                clearTimeout(timer);
            }
        }
        catch {
            lastFailureAt = Date.now();
            return null;
        }
        finally {
            inFlight = null;
        }
    })();
    return inFlight;
}
async function resolveWebVersionPin(fetcher = fetch) {
    const raw = process.env.WWEBJS_WEB_VERSION?.trim();
    const lc = raw?.toLowerCase();
    if (raw && lc !== 'off' && lc !== 'latest' && lc !== 'auto') {
        return buildRemotePin(raw);
    }
    if (lc === 'off')
        return undefined;
    const current = await resolveCurrentWebVersion(fetcher);
    return current ? buildRemotePin(current) : undefined;
}
function getEffectiveWebVersionInfo() {
    const raw = process.env.WWEBJS_WEB_VERSION?.trim();
    const lc = raw?.toLowerCase();
    if (raw && lc !== 'off' && lc !== 'latest' && lc !== 'auto')
        return { version: raw, source: 'pinned' };
    if (lc === 'off')
        return { version: null, source: 'native' };
    return { version: cachedCurrentVersion ?? null, source: 'auto' };
}
//# sourceMappingURL=wa-web-version.js.map