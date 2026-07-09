import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
export declare class TemplateService {
    private readonly templateRepository;
    private readonly logger;
    constructor(templateRepository: Repository<Template>);
    create(sessionId: string, dto: CreateTemplateDto): Promise<Template>;
    findBySession(sessionId: string): Promise<Template[]>;
    findOne(sessionId: string, id: string): Promise<Template>;
    resolve(sessionId: string, identifier: {
        templateId?: string;
        templateName?: string;
    }): Promise<Template>;
    update(sessionId: string, id: string, dto: UpdateTemplateDto): Promise<Template>;
    delete(sessionId: string, id: string): Promise<void>;
}
