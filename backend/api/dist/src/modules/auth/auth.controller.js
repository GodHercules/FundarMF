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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const request_link_dto_1 = require("./dto/request-link.dto");
const verify_link_dto_1 = require("./dto/verify-link.dto");
const login_dto_1 = require("./dto/login.dto");
const session_service_1 = require("./session.service");
const auth_guard_1 = require("../../common/auth/auth.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const resend_otp_dto_1 = require("./dto/resend-otp.dto");
let AuthController = class AuthController {
    authService;
    sessionService;
    constructor(authService, sessionService) {
        this.authService = authService;
        this.sessionService = sessionService;
    }
    async requestLink(dto) {
        return this.authService.requestCustomerLink(dto.email, dto.whatsapp, dto.nome);
    }
    async verify(dto, res) {
        const { sessionToken } = await this.authService.verifyCustomerLink(dto.token, dto.otp);
        res.cookie(this.sessionService.cookieName, sessionToken, this.sessionService.buildCookieOptions());
        return { ok: true };
    }
    async resendOtp(dto) {
        return this.authService.resendCustomerOtp(dto.token);
    }
    async login(dto, res) {
        const { token, role } = await this.authService.loginAny(dto.email, dto.password);
        res.cookie(this.sessionService.cookieName, token, this.sessionService.buildCookieOptions());
        return { ok: true, role };
    }
    async loginOperator(dto, res) {
        const { token } = await this.authService.loginUser(dto.email, dto.password, "OPERATOR");
        res.cookie(this.sessionService.cookieName, token, this.sessionService.buildCookieOptions());
        return { ok: true };
    }
    async loginMaster(dto, res) {
        const { token } = await this.authService.loginUser(dto.email, dto.password, "MASTER");
        res.cookie(this.sessionService.cookieName, token, this.sessionService.buildCookieOptions());
        return { ok: true };
    }
    async logout(req, res) {
        await this.authService.logout(req.sessionId, req.actor);
        res.clearCookie(this.sessionService.cookieName);
        return { ok: true };
    }
    async me(req) {
        return { actor: req.actor };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)("customer/request-link"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("OPERADOR", "MASTER"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_link_dto_1.RequestLinkDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "requestLink", null);
__decorate([
    (0, common_1.Post)("customer/verify"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_link_dto_1.VerifyLinkDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)("customer/resend-otp"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_otp_dto_1.ResendOtpDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendOtp", null);
__decorate([
    (0, common_1.Post)("login"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)("operator/login"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginOperator", null);
__decorate([
    (0, common_1.Post)("master/login"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginMaster", null);
__decorate([
    (0, common_1.Post)("logout"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)("me"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)("auth"),
    __metadata("design:paramtypes", [auth_service_1.AuthService, session_service_1.SessionService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map