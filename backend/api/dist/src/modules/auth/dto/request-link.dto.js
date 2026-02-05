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
exports.RequestLinkDto = void 0;
const class_validator_1 = require("class-validator");
class RequestLinkDto {
    nome;
    email;
    whatsapp;
}
exports.RequestLinkDto = RequestLinkDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], RequestLinkDto.prototype, "nome", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((value) => value.email !== undefined),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RequestLinkDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\+?[1-9]\d{7,14}$/),
    __metadata("design:type", String)
], RequestLinkDto.prototype, "whatsapp", void 0);
//# sourceMappingURL=request-link.dto.js.map