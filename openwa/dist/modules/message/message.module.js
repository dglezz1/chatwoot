"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const message_service_1 = require("./message.service");
const bulk_message_service_1 = require("./bulk-message.service");
const message_type_backfill_service_1 = require("./message-type-backfill.service");
const message_controller_1 = require("./message.controller");
const session_module_1 = require("../session/session.module");
const template_module_1 = require("../template/template.module");
const message_entity_1 = require("./entities/message.entity");
const message_batch_entity_1 = require("./entities/message-batch.entity");
let MessageModule = class MessageModule {
};
exports.MessageModule = MessageModule;
exports.MessageModule = MessageModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([message_entity_1.Message, message_batch_entity_1.MessageBatch], 'data'), session_module_1.SessionModule, template_module_1.TemplateModule],
        controllers: [message_controller_1.MessageController],
        providers: [message_service_1.MessageService, bulk_message_service_1.BulkMessageService, message_type_backfill_service_1.MessageTypeBackfillService],
        exports: [message_service_1.MessageService, bulk_message_service_1.BulkMessageService],
    })
], MessageModule);
//# sourceMappingURL=message.module.js.map