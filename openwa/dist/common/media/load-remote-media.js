"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRemoteMediaBuffer = loadRemoteMediaBuffer;
const ssrf_guard_1 = require("../security/ssrf-guard");
const DEFAULT_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_MEDIA_TIMEOUT_MS = 30_000;
function positiveIntFromEnv(name, fallback) {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
async function loadRemoteMediaBuffer(url) {
    const maxBytes = positiveIntFromEnv('MEDIA_DOWNLOAD_MAX_BYTES', DEFAULT_MEDIA_MAX_BYTES);
    const timeoutMs = positiveIntFromEnv('MEDIA_DOWNLOAD_TIMEOUT_MS', DEFAULT_MEDIA_TIMEOUT_MS);
    return (0, ssrf_guard_1.withSafeFetch)(url, { signal: AbortSignal.timeout(timeoutMs) }, async (response) => {
        if (!response.ok) {
            throw new Error(`Media fetch failed with status ${response.status}`);
        }
        const declaredLength = Number(response.headers.get('content-length') ?? '');
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
            throw new Error(`Media exceeds the ${maxBytes}-byte limit`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Media response has no body');
        }
        const chunks = [];
        let total = 0;
        for (;;) {
            const { done, value } = (await reader.read());
            if (done) {
                break;
            }
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new Error(`Media exceeds the ${maxBytes}-byte limit`);
            }
            chunks.push(Buffer.from(value));
        }
        const mimetype = (response.headers.get('content-type') ?? '').split(';')[0].trim();
        return { data: Buffer.concat(chunks), mimetype };
    });
}
//# sourceMappingURL=load-remote-media.js.map