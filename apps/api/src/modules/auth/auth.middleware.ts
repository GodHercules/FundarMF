import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import dayjs from "dayjs";
import { SessionService } from "./session.service";
import { PrismaService } from "../../shared/prisma.service";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService, private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.[this.sessionService.cookieName];
    if (!token) {
      return next();
    }

    const session = await this.sessionService.findSessionByToken(token);
    if (!session) {
      res.clearCookie(this.sessionService.cookieName);
      return next();
    }

    if (dayjs(session.expiresAt).isBefore(dayjs())) {
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
    if (dayjs(session.lastActiveAt).add(rotationMinutes, "minute").isBefore(dayjs())) {
      const { token: newToken } = await this.sessionService.rotateSession(session.id, Number(process.env.SESSION_TTL_HOURS ?? 48));
      res.cookie(this.sessionService.cookieName, newToken, this.sessionService.buildCookieOptions());
    } else {
      await this.sessionService.markActivity(session.id);
    }

    return next();
  }
}
