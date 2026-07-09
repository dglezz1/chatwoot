"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSafeBuffer = fetchSafeBuffer;
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
async function fetchSafeBuffer(url, opts = {}) {
    const maxBytes = Number.isFinite(opts.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : DEFAULT_MAX_BYTES;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return (0, ssrf_guard_1.withSafeFetch)(url, { signal: AbortSignal.timeout(timeoutMs) }, async (response) => {
        if (!response.ok) {
            throw new Error(`download failed with status ${response.status}`);
        }
        const declaredLength = Number(response.headers.get('content-length') ?? '');
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
            throw new Error(`download exceeds the ${maxBytes}-byte limit`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('download response has no body');
        }
        const chunks = [];
        let total = 0;
        for (;;) {
            const { done, value } = (await reader.read());
            if (done)
                break;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new Error(`download exceeds the ${maxBytes}-byte limit`);
            }
            chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks);
    }, { followRedirects: true });
}
//# sourceMappingURL=plugin-download.js.map