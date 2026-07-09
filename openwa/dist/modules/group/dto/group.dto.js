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
exports.GroupDescriptionDto = exports.GroupSubjectDto = exports.ParticipantsDto = exports.CreateGroupDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateGroupDto {
    name;
    participants;
}
exports.CreateGroupDto = CreateGroupDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Group subject/name', maxLength: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateGroupDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Participant WhatsApp IDs (e.g. 628123456789@c.us)', type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateGroupDto.prototype, "participants", void 0);
class ParticipantsDto {
    participants;
}
exports.ParticipantsDto = ParticipantsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Participant WhatsApp IDs (e.g. 628123456789@c.us)', type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ParticipantsDto.prototype, "participants", void 0);
class GroupSubjectDto {
    subject;
}
exports.GroupSubjectDto = GroupSubjectDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'New group subject/name', maxLength: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GroupSubjectDto.prototype, "subject", void 0);
class GroupDescriptionDto {
    description;
}
exports.GroupDescriptionDto = GroupDescriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'New group description (may be empty to clear it)', maxLength: 1024 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1024),
    __metadata("design:type", String)
], GroupDescriptionDto.prototype, "description", void 0);
//# sourceMappingURL=group.dto.js.map