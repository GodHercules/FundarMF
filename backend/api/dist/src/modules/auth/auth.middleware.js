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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = void 0;
const common_1 = require("@nestjs/common");
const dayjs_1 = __importDefault(require("dayjs"));
const session_service_1 = require("./session.service");
const prisma_service_1 = require("../../shared/prisma.service");
let AuthMiddleware = class AuthMiddleware {
    sessionService;
    prisma;
    constructor(sessionService, prisma) {
        this.sessionService = sessionService;
        this.prisma = prisma;
    }
    async use(req, res, next) {
        const token = req.cookies?.[this.sessionService.cookieName];
        if (!token) {
            return next();
        }
        const session = await this.sessionService.findSessionByToken(token);
        if (!session) {
            res.clearCookie(this.sessionService.cookieName);
            return next();
        }
        if ((0, dayjs_1.default)(session.expiresAt).isBefore((0, dayjs_1.default)())) {
            await this.prisma.session.delete({ where: { id: session.id } });
            res.clearCookie(this.sessionService.cookieName);
            return next();
        }
        req.sessionId = session.id;
        req.actor = {
            role: session.role,
            userId: session.userId ?? undefined,
            email: session.clientEmail ?? undefined,
            whatsapp: session.clientWhatsapp ?? undefined
        };
        const rotationMinutes = Number(process.env.SESSION_ROTATE_MINUTES ?? 60);
        if ((0, dayjs_1.default)(session.lastActiveAt).add(rotationMinutes, "minute").isBefore((0, dayjs_1.default)())) {
            const { token: newToken } = await this.sessionService.rotateSession(session.id, Number(process.env.SESSION_TTL_HOURS ?? 48));
            res.cookie(this.sessionService.cookieName, newToken, this.sessionService.buildCookieOptions());
        }
        else {
            await this.sessionService.markActivity(session.id);
        }
        return next();
    }
};
exports.AuthMiddleware = AuthMiddleware;
exports.AuthMiddleware = AuthMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [session_service_1.SessionService, prisma_service_1.PrismaService])
], AuthMiddleware);
//# sourceMappingURL=auth.middleware.js.map