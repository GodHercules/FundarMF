import { Injectable } from "@nestjs/common";
import crypto from "crypto";
import dayjs from "dayjs";

import { Actor } from "../../common/auth/types";
import { PrismaService } from "../../shared/prisma.service";

const SESSION_COOKIE = "fundarmf_session";

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  get cookieName() {
    return SESSION_COOKIE;
  }

  generateToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async createSession(actor: Actor, ttlHours: number) {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = dayjs().add(ttlHours, "hour").toDate();
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

  async findSessionByToken(token: string) {
    const tokenHash = this.hashToken(token);
    return this.prisma.session.findUnique({ where: { tokenHash } });
  }

  async rotateSession(sessionId: string, ttlHours: number) {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = dayjs().add(ttlHours, "hour").toDate();
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

  async markActivity(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() }
    });
  }

  buildCookieOptions() {
    const cookieSecureRaw = process.env.COOKIE_SECURE?.trim();
    const defaultSecure = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
    const configuredSecure =
      cookieSecureRaw === undefined || cookieSecureRaw.length === 0
        ? defaultSecure
        : cookieSecureRaw.toLowerCase() === "true";
    const secure = defaultSecure || configuredSecure;

    return {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      maxAge: Number(process.env.SESSION_TTL_HOURS ?? 48) * 60 * 60 * 1000,
      path: "/"
    };
  }
}
