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
exports.SessionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dayjs_1 = __importDefault(require("dayjs"));
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
const SESSION_COOKIE = "fundarmf_session";
let SessionService = class SessionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get cookieName() {
        return SESSION_COOKIE;
    }
    generateToken() {
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    hashToken(token) {
        return crypto_1.default.createHash("sha256").update(token).digest("hex");
    }
    async createSession(actor, ttlHours) {
        const token = this.generateToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = (0, dayjs_1.default)().add(ttlHours, "hour").toDate();
        const session = await this.prisma.session.create({
            data: {
                role: actor.role,
                userId: actor.userId,
                clientEmail: actor.email,
                clientWhatsapp: actor.whatsapp,
                tokenHash,
                expiresAt,
                lastActiveAt: new Date()
            }
        });
        return { session, token };
    }
    async findSessionByToken(token) {
        const tokenHash = this.hashToken(token);
        return this.prisma.session.findUnique({ where: { tokenHash } });
    }
    async rotateSession(sessionId, ttlHours) {
        const token = this.generateToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = (0, dayjs_1.default)().add(ttlHours, "hour").toDate();
        await this.prisma.session.update({
            where: { id: sessionId },
            data: {
                tokenHash,
                expiresAt,
                lastActiveAt: new Date(),
                rotatedAt: new Date()
            }
        });
        return { token };
    }
    async markActivity(sessionId) {
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { lastActiveAt: new Date() }
        });
    }
    buildCookieOptions() {
        const cookieSecureRaw = process.env.COOKIE_SECURE?.trim();
        const defaultSecure = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
        const secure = cookieSecureRaw === undefined || cookieSecureRaw.length === 0
            ? defaultSecure
            : cookieSecureRaw.toLowerCase() === "true";
        return {
            httpOnly: true,
            secure,
            sameSite: "lax",
            maxAge: Number(process.env.SESSION_TTL_HOURS ?? 48) * 60 * 60 * 1000,
            path: "/"
        };
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SessionService);
//# sourceMappingURL=session.service.js.map