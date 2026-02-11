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
exports.ProcessController = void 0;
const common_1 = require("@nestjs/common");
const process_service_1 = require("./process.service");
const auth_guard_1 = require("../../common/auth/auth.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const create_process_dto_1 = require("./dto/create-process.dto");
const send_link_dto_1 = require("./dto/send-link.dto");
const update_step_dto_1 = require("./dto/update-step.dto");
const submit_step_dto_1 = require("./dto/submit-step.dto");
const approve_step_dto_1 = require("./dto/approve-step.dto");
const request_correction_dto_1 = require("./dto/request-correction.dto");
const cancel_dto_1 = require("./dto/cancel.dto");
const update_status_dto_1 = require("./dto/update-status.dto");
let ProcessController = class ProcessController {
    processService;
    constructor(processService) {
        this.processService = processService;
    }
    async create(dto, req) {
        return this.processService.createProcessByOperator(req.actor, {
            nome: dto.nome,
            email: dto.email,
            telefone: dto.telefone,
            sendEmail: dto.sendEmail,
            sendWhatsapp: dto.sendWhatsapp
        });
    }
    async sendLink(id, dto, req) {
        return this.processService.sendClientLink(id, req.actor, {
            sendEmail: dto.sendEmail,
            sendWhatsapp: dto.sendWhatsapp
        });
    }
    async sendOtp(id, req) {
        return this.processService.sendClientOtp(id, req.actor);
    }
    async list(req, limit, offset) {
        return this.processService.listProcesses(req.actor, {
            take: limit ? Number(limit) : undefined,
            skip: offset ? Number(offset) : undefined
        });
    }
    async get(id, req) {
        return this.processService.getProcess(id, req.actor);
    }
    async updateStep(id, dto, req) {
        return this.processService.updateStep(id, req.actor, dto.stepKey, dto.data);
    }
    async submit(id, dto, req) {
        return this.processService.submitStep(id, req.actor, dto.stepKey);
    }
    async approve(id, dto, req) {
        return this.processService.approveStep(id, req.actor, dto.stepKey);
    }
    async correction(id, dto, req) {
        return this.processService.requestCorrection(id, req.actor, dto.stepKey, dto.fields, dto.reason);
    }
    async markInProgress(id, req) {
        return this.processService.markInProgress(id, req.actor);
    }
    async updateClientStatus(id, dto, req) {
        return this.processService.updateClientStatus(id, req.actor, dto.message);
    }
    async cancel(id, dto, req) {
        return this.processService.cancelProcess(id, req.actor, dto.reason);
    }
};
exports.ProcessController = ProcessController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)("OPERADOR", "MASTER"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_process_dto_1.CreateProcessDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(":id/send-link"),
    (0, roles_decorator_1.Roles)("OPERADOR", "MASTER"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_link_dto_1.SendLinkDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "sendLink", null);
__decorate([
    (0, common_1.Post)(":id/send-otp"),
    (0, roles_decorator_1.Roles)("OPERADOR", "MASTER"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "sendOtp", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("limit")),
    __param(2, (0, common_1.Query)("offset")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(":id/steps"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_step_dto_1.UpdateStepDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "updateStep", null);
__decorate([
    (0, common_1.Post)(":id/submit-step"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submit_step_dto_1.SubmitStepDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(":id/approve-step"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_step_dto_1.ApproveStepDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(":id/request-correction"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, request_correction_dto_1.RequestCorrectionDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "correction", null);
__decorate([
    (0, common_1.Post)(":id/mark-in-progress"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "markInProgress", null);
__decorate([
    (0, common_1.Post)(":id/status-update"),
    (0, roles_decorator_1.Roles)("OPERADOR", "MASTER"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_status_dto_1.UpdateStatusDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "updateClientStatus", null);
__decorate([
    (0, common_1.Post)(":id/cancel"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_dto_1.CancelDto, Object]),
    __metadata("design:returntype", Promise)
], ProcessController.prototype, "cancel", null);
exports.ProcessController = ProcessController = __decorate([
    (0, common_1.Controller)("processes"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [process_service_1.ProcessService])
], ProcessController);
//# sourceMappingURL=process.controller.js.map