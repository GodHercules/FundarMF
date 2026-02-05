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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const admin_service_1 = require("./admin.service");
const create_user_dto_1 = require("./create-user.dto");
const assign_owner_dto_1 = require("./assign-owner.dto");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async listUsers(limit, offset) {
        return this.adminService.listUsers(limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
    }
    async createUser(dto, req) {
        return this.adminService.createOperator(dto.email, dto.name, dto.password, dto.whatsapp);
    }
    async assign(id, dto, req) {
        return this.adminService.assignOwner(id, dto.ownerId, req.actor?.userId);
    }
    async unassigned() {
        return this.adminService.listUnassigned();
    }
    async audit() {
        return this.adminService.listAudit();
    }
    async report(processId, res) {
        const report = await this.adminService.getReport(processId);
        res.setHeader("Content-Type", report.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename=\"${report.fileName}\"`);
        res.send(report.data);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)("users"),
    __param(0, (0, common_1.Query)("limit")),
    __param(1, (0, common_1.Query)("offset")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Post)("users"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Post)("processes/:id/assign"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_owner_dto_1.AssignOwnerDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "assign", null);
__decorate([
    (0, common_1.Get)("processes/unassigned"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "unassigned", null);
__decorate([
    (0, common_1.Get)("audit"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "audit", null);
__decorate([
    (0, common_1.Get)("reports/:processId"),
    __param(0, (0, common_1.Param)("processId")),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "report", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)("admin"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("MASTER"),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map