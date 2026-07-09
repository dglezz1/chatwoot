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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
const search_service_1 = require("./search.service");
const search_query_dto_1 = require("./dto/search-query.dto");
let SearchController = class SearchController {
    searchService;
    constructor(searchService) {
        this.searchService = searchService;
    }
    async search(dto, apiKey) {
        if (!dto.q || !dto.q.trim()) {
            throw new common_1.BadRequestException('Query parameter "q" is required and must be non-empty.');
        }
        return this.searchService.search(dto, apiKey?.allowedSessions ?? undefined);
    }
};
exports.SearchController = SearchController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.OPERATOR),
    (0, swagger_1.ApiOperation)({ summary: 'Search messages across sessions (active search provider)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Search results from the active provider' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Empty or whitespace-only "q"' }),
    (0, swagger_1.ApiResponse)({ status: 501, description: 'No search provider configured' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: true, description: 'Search term (required, non-empty)' }),
    (0, swagger_1.ApiQuery)({ name: 'sessionId', required: false, description: 'Restrict to a single session' }),
    (0, swagger_1.ApiQuery)({ name: 'chatId', required: false, description: 'Restrict to a single chat id' }),
    (0, swagger_1.ApiQuery)({ name: 'direction', required: false, description: 'incoming | outgoing' }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, description: 'Message type filter' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false, description: 'Sender filter' }),
    (0, swagger_1.ApiQuery)({ name: 'dateFrom', required: false, description: 'Epoch-ms lower bound (inclusive)' }),
    (0, swagger_1.ApiQuery)({ name: 'dateTo', required: false, description: 'Epoch-ms upper bound (inclusive)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Max hits to return' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number, description: 'Pagination offset' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, auth_decorators_1.CurrentApiKey)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_query_dto_1.SearchQueryDto, api_key_entity_1.ApiKey]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "search", null);
exports.SearchController = SearchController = __decorate([
    (0, swagger_1.ApiTags)('search'),
    (0, common_1.Controller)('search'),
    __metadata("design:paramtypes", [search_service_1.SearchService])
], SearchController);
//# sourceMappingURL=search.controller.js.map