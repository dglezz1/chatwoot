"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyAwareThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const ip_1 = require("../utils/ip");
let ProxyAwareThrottlerGuard = class ProxyAwareThrottlerGuard extends throttler_1.ThrottlerGuard {
    getTracker(req) {
        const trustedProxies = (process.env.TRUSTED_PROXIES || '')
            .split(',')
            .map(proxy => proxy.trim())
            .filter(Boolean);
        return Promise.resolve((0, ip_1.resolveClientIp)(req, trustedProxies));
    }
};
exports.ProxyAwareThrottlerGuard = ProxyAwareThrottlerGuard;
exports.ProxyAwareThrottlerGuard = ProxyAwareThrottlerGuard = __decorate([
    (0, common_1.Injectable)()
], ProxyAwareThrottlerGuard);
//# sourceMappingURL=proxy-aware-throttler.guard.js.map