"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIp = normalizeIp;
exports.resolveClientIp = resolveClientIp;
exports.ipMatches = ipMatches;
function normalizeIp(ip) {
    if (!ip)
        return ip;
    const match = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    return match ? match[1] : ip;
}
function resolveClientIp(req, trustedProxies) {
    const socketIp = normalizeIp(req.socket?.remoteAddress || req.ip || '');
    if (!trustedProxies || trustedProxies.length === 0) {
        return socketIp;
    }
    const isTrusted = (ip) => trustedProxies.some(proxy => ipMatches(ip, proxy));
    if (!isTrusted(socketIp)) {
        return socketIp;
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (!forwarded) {
        return socketIp;
    }
    const hops = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)
        .split(',')
        .map(hop => normalizeIp(hop.trim()))
        .filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
        if (!isTrusted(hops[i])) {
            return hops[i];
        }
    }
    return socketIp;
}
function ipv4ToInt(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4)
        return null;
    let result = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part))
            return null;
        const octet = Number(part);
        if (octet > 255)
            return null;
        result = result * 256 + octet;
    }
    return result >>> 0;
}
function ipMatches(ip, target) {
    const candidate = normalizeIp((ip || '').trim());
    const ref = (target || '').trim();
    if (!ref.includes('/')) {
        return normalizeIp(ref) === candidate;
    }
    const [range, bitsRaw] = ref.split('/');
    const bits = Number(bitsRaw);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32)
        return false;
    const ipInt = ipv4ToInt(candidate);
    const rangeInt = ipv4ToInt(normalizeIp(range));
    if (ipInt === null || rangeInt === null)
        return false;
    if (bits === 0)
        return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
}
//# sourceMappingURL=ip.js.map