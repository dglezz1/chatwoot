"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareSemver = compareSemver;
exports.annotateCatalog = annotateCatalog;
function compareSemver(a, b) {
    const parse = (v) => String(v)
        .split('-')[0]
        .split('.')
        .map(n => Number.parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0)
            return d > 0 ? 1 : -1;
    }
    return 0;
}
function annotateCatalog(entries, installed) {
    const byId = new Map(installed.map(p => [p.id, p.version]));
    return entries.map(entry => {
        const installedVersion = byId.get(entry.id) ?? null;
        return {
            ...entry,
            installed: installedVersion !== null,
            installedVersion,
            updateAvailable: installedVersion !== null && compareSemver(entry.version, installedVersion) > 0,
        };
    });
}
//# sourceMappingURL=catalog.js.map