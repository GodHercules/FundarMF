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
exports.SlaController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const sla_service_1 = require("./sla.service");
const auth_guard_1 = require("../../common/auth/auth.guard");
class UpdateSlaDto {
    stepKey;
    side;
    durationHours;
    alertPercent;
}
__decorate([
    (0, class_validator_1.IsIn)(["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"]),
    __metadata("design:type", Object)
], UpdateSlaDto.prototype, "stepKey", void 0);
__decorate([
    (0, class_validator_1.IsIn)(["CLIENTE", "OPERADOR"]),
    __metadata("design:type", Object)
], UpdateSlaDto.prototype, "side", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateSlaDto.prototype, "durationHours", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateSlaDto.prototype, "alertPercent", void 0);
let SlaController = class SlaController {
    slaService;
    constructor(slaService) {
        this.slaService = slaService;
    }
    async listConfig() {
        return this.slaService.listConfig();
    }
    async update(dto) {
        return this.slaService.updateConfig(dto.stepKey, dto.side, dto.durationHours, dto.alertPercent);
    }
};
exports.SlaController = SlaController;
__decorate([
    (0, common_1.Get)("config"),
    (0, roles_decorator_1.Roles)("MASTER"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SlaController.prototype, "listConfig", null);
__decorate([
    (0, common_1.Put)("config"),
    (0, roles_decorator_1.Roles)("MASTER"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateSlaDto]),
    __metadata("design:returntype", Promise)
], SlaController.prototype, "update", null);
exports.SlaController = SlaController = __decorate([
    (0, common_1.Controller)("sla"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [sla_service_1.SlaService])
], SlaController);
//# sourceMappingURL=sla.controller.js.map