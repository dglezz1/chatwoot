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
exports.RedriveController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorators_1 = require("../auth/decorators/auth.decorators");
const api_key_entity_1 = require("../auth/entities/api-key.entity");
const redrive_service_1 = require("./redrive.service");
let RedriveController = class RedriveController {
    redrive;
    constructor(redrive) {
        this.redrive = redrive;
    }
    redriveInstance(pluginId, instanceId) {
        return this.redrive.redriveInstance(pluginId, instanceId);
    }
};
exports.RedriveController = RedriveController;
__decorate([
    (0, common_1.Post)(':pluginId/:instanceId/redrive'),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Dead-lettered ingress deliveries for the instance re-dispatched. Returns the count redriven.',
    }),
    __param(0, (0, common_1.Param)('pluginId')),
    __param(1, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RedriveController.prototype, "redriveInstance", null);
exports.RedriveController = RedriveController = __decorate([
    (0, swagger_1.ApiTags)('integration'),
    (0, common_1.Controller)('integration/instances'),
    (0, auth_decorators_1.RequireRole)(api_key_entity_1.ApiKeyRole.ADMIN),
    __metadata("design:paramtypes", [redrive_service_1.RedriveService])
], RedriveController);
//# sourceMappingURL=redrive.controller.js.map