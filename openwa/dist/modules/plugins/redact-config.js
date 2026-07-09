"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECRET_SENTINEL = void 0;
exports.redactSecretConfig = redactSecretConfig;
exports.restoreSecretConfig = restoreSecretConfig;
exports.SECRET_SENTINEL = '***';
const isMeaningful = (v) => v !== undefined && v !== null && v !== '';
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
function redactValue(value, field) {
    if (field.secret && isMeaningful(value))
        return exports.SECRET_SENTINEL;
    if (field.type === 'object' && field.properties && isPlainObject(value)) {
        return redactObject(value, field.properties);
    }
    if (field.type === 'array' && field.items && Array.isArray(value)) {
        return value.map(item => redactValue(item, field.items));
    }
    return value;
}
function redactObject(config, properties) {
    const out = { ...config };
    for (const [key, field] of Object.entries(properties)) {
        if (key in out)
            out[key] = redactValue(out[key], field);
    }
    return out;
}
function redactSecretConfig(config, schema) {
    const out = { ...(config ?? {}) };
    if (!schema?.properties) {
        for (const key of Object.keys(out)) {
            if (isMeaningful(out[key]))
                out[key] = exports.SECRET_SENTINEL;
        }
        return out;
    }
    return redactObject(out, schema.properties);
}
function stableStringify(v) {
    if (Array.isArray(v))
        return '[' + v.map(stableStringify).join(',') + ']';
    if (isPlainObject(v)) {
        return ('{' +
            Object.keys(v)
                .sort()
                .map(k => JSON.stringify(k) + ':' + stableStringify(v[k]))
                .join(',') +
            '}');
    }
    return JSON.stringify(v) ?? 'null';
}
function elementSignature(value, field) {
    return stableStringify(redactValue(value, field));
}
function restoreValue(incoming, existing, field) {
    if (field.secret) {
        if (incoming === exports.SECRET_SENTINEL || !isMeaningful(incoming)) {
            return isMeaningful(existing) ? { keep: true, value: existing } : { keep: false };
        }
        return { keep: true, value: incoming };
    }
    if (field.type === 'object' && field.properties && isPlainObject(incoming)) {
        return {
            keep: true,
            value: restoreObject(incoming, isPlainObject(existing) ? existing : undefined, field.properties),
        };
    }
    if (field.type === 'array' && field.items && Array.isArray(incoming)) {
        const itemField = field.items;
        const existingArr = Array.isArray(existing) ? existing : [];
        const sigCount = new Map();
        const sigFirst = new Map();
        for (const ex of existingArr) {
            const s = elementSignature(ex, itemField);
            sigCount.set(s, (sigCount.get(s) ?? 0) + 1);
            if (!sigFirst.has(s))
                sigFirst.set(s, ex);
        }
        const sameLength = incoming.length === existingArr.length;
        return {
            keep: true,
            value: incoming
                .map((item, i) => {
                const s = elementSignature(item, itemField);
                const twin = existingArr[i];
                const match = sigCount.get(s) === 1
                    ? sigFirst.get(s)
                    : sameLength
                        ? twin
                        : twin !== undefined && elementSignature(twin, itemField) === s
                            ? twin
                            : undefined;
                return restoreValue(item, match, itemField);
            })
                .filter(r => r.keep)
                .map(r => r.value),
        };
    }
    return { keep: true, value: incoming };
}
function restoreObject(incoming, existing, properties) {
    const out = { ...incoming };
    for (const [key, field] of Object.entries(properties)) {
        if (!(key in out))
            continue;
        const r = restoreValue(out[key], existing?.[key], field);
        if (r.keep)
            out[key] = r.value;
        else
            delete out[key];
    }
    return out;
}
function restoreSecretConfig(incoming, existing, schema) {
    if (!schema?.properties) {
        const out = { ...incoming };
        const ex = existing ?? {};
        for (const key of Object.keys(out)) {
            if (out[key] !== exports.SECRET_SENTINEL)
                continue;
            if (isMeaningful(ex[key]))
                out[key] = ex[key];
            else
                delete out[key];
        }
        return out;
    }
    return restoreObject(incoming, existing, schema.properties);
}
//# sourceMappingURL=redact-config.js.map