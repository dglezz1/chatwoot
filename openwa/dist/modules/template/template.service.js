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
exports.TemplateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const template_entity_1 = require("./entities/template.entity");
const logger_service_1 = require("../../common/services/logger.service");
const unique_constraint_util_1 = require("../../common/utils/unique-constraint.util");
let TemplateService = class TemplateService {
    templateRepository;
    logger = (0, logger_service_1.createLogger)('TemplateService');
    constructor(templateRepository) {
        this.templateRepository = templateRepository;
    }
    async create(sessionId, dto) {
        const template = this.templateRepository.create({
            sessionId,
            name: dto.name,
            body: dto.body,
            header: dto.header ?? null,
            footer: dto.footer ?? null,
        });
        try {
            const saved = await this.templateRepository.save(template);
            this.logger.log('Template created', { sessionId, templateId: saved.id, name: saved.name });
            return saved;
        }
        catch (err) {
            if ((0, unique_constraint_util_1.isUniqueConstraintError)(err)) {
                throw new common_1.ConflictException(`A template named '${dto.name}' already exists for this session`);
            }
            throw err;
        }
    }
    async findBySession(sessionId) {
        return this.templateRepository.find({
            where: { sessionId },
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(sessionId, id) {
        const template = await this.templateRepository.findOne({ where: { id, sessionId } });
        if (!template) {
            throw new common_1.NotFoundException(`Template with id '${id}' not found`);
        }
        return template;
    }
    async resolve(sessionId, identifier) {
        const { templateId, templateName } = identifier;
        if (templateId) {
            return this.findOne(sessionId, templateId);
        }
        if (templateName) {
            const template = await this.templateRepository.findOne({
                where: { name: templateName, sessionId },
                order: { createdAt: 'ASC' },
            });
            if (!template) {
                throw new common_1.NotFoundException(`Template with name '${templateName}' not found`);
            }
            return template;
        }
        throw new common_1.NotFoundException('Either templateId or templateName must be provided');
    }
    async update(sessionId, id, dto) {
        const template = await this.findOne(sessionId, id);
        if (dto.name !== undefined)
            template.name = dto.name;
        if (dto.body !== undefined)
            template.body = dto.body;
        if (dto.header !== undefined)
            template.header = dto.header;
        if (dto.footer !== undefined)
            template.footer = dto.footer;
        try {
            return await this.templateRepository.save(template);
        }
        catch (err) {
            if ((0, unique_constraint_util_1.isUniqueConstraintError)(err)) {
                throw new common_1.ConflictException(`A template named '${template.name}' already exists for this session`);
            }
            throw err;
        }
    }
    async delete(sessionId, id) {
        const template = await this.findOne(sessionId, id);
        await this.templateRepository.remove(template);
        this.logger.log('Template deleted', { sessionId, templateId: id });
    }
};
exports.TemplateService = TemplateService;
exports.TemplateService = TemplateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(template_entity_1.Template, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TemplateService);
//# sourceMappingURL=template.service.js.map