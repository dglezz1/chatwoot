"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const session_service_1 = require("../session/session.service");
let CatalogService = class CatalogService {
    sessionService;
    constructor(sessionService) {
        this.sessionService = sessionService;
    }
    async getCatalog(sessionId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.getCatalog();
    }
    async getProducts(sessionId, page = 1, limit = 20) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.getProducts({ page, limit });
    }
    async getProduct(sessionId, productId) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.getProduct(productId);
    }
    async sendProduct(sessionId, chatId, productId, body) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.sendProduct(chatId, productId, body);
    }
    async sendCatalog(sessionId, chatId, body) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.NotFoundException(`Session ${sessionId} not found or not connected`);
        }
        return engine.sendCatalog(chatId, body);
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map