import crypto from "crypto";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { SessionService } from "./session.service";
import { NotificationService } from "../notification/notification.service";
import { AuditService } from "../audit/audit.service";
import { Actor } from "../../common/auth/types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService
  ) {}

  private hash(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private normalizeWhatsApp(value: string) {
    const cleaned = value.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
    return `+${cleaned}`;
  }

  private buildCustomerAccessWhatsApp(linkUrl: string, otp?: string) {
    const brand = process.env.WHATSAPP_BRAND ?? process.env.COMPANY_NAME ?? "MF Contabilidade";
    const location = process.env.COMPANY_LOCATION ?? "Bahia, Brazil";
    const linkTtl = Number(process.env.LINK_TTL_HOURS ?? 24);
    const otpTtl = Number(process.env.OTP_TTL_MINUTES ?? 10);
    return [
      `${brand} | Acesso do cliente`,
      location,
      `Link: ${linkUrl}`,
      otp ? `OTP: ${otp}` : "OTP: não necessário",
      `Link válido por ${linkTtl}h.`,
      otp ? `OTP válido por ${otpTtl}min.` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  private ensureWhatsAppConfigured() {
    const hasTwilio = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID)
    );
    return hasTwilio;
  }

  private buildCustomerAccessEmail(linkUrl: string, otp?: string) {
    const linkTtl = Number(process.env.LINK_TTL_HOURS ?? 24);
    const otpTtl = Number(process.env.OTP_TTL_MINUTES ?? 10);

    const lines = [
      "Olá,",
      "",
      "Seu acesso seguro ao portal do cliente FundarMF foi solicitado.",
      "",
      `1) Abra este link: ${linkUrl}`,
      otp ? `2) Informe o OTP: ${otp}` : "2) Não é necessário OTP neste acesso.",
      "",
      `Este link expira em ${linkTtl} horas.`,
      otp ? `O OTP expira em ${otpTtl} minutos.` : "",
      "",
      "Se você não solicitou este acesso, ignore este e-mail."
    ].filter(Boolean);

    return lines.join("\n");
  }

  async requestCustomerLink(email?: string, whatsapp?: string) {
    if (!email && !whatsapp) {
      throw new BadRequestException("Informe e-mail ou WhatsApp.");
    }

    const normalizedWhatsapp = whatsapp ? this.normalizeWhatsApp(whatsapp) : undefined;
    const activeSession = await this.prisma.session.findFirst({
      where: email
        ? {
            clientEmail: email,
            role: "CLIENTE",
            expiresAt: { gt: new Date() }
          }
        : {
            clientWhatsapp: normalizedWhatsapp,
            role: "CLIENTE",
            expiresAt: { gt: new Date() }
          }
    });

    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = this.hash(token);
    const tokenExpiresAt = dayjs().add(Number(process.env.LINK_TTL_HOURS ?? 24), "hour").toDate();

    let otp: string | undefined;
    let otpHash: string | undefined;
    let otpExpiresAt: Date | undefined;

    if (!activeSession) {
      otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpHash = this.hash(otp);
      otpExpiresAt = dayjs().add(Number(process.env.OTP_TTL_MINUTES ?? 10), "minute").toDate();
    }

    await this.prisma.customerLinkToken.create({
      data: {
        email,
        whatsapp: normalizedWhatsapp,
        tokenHash,
        tokenExpiresAt,
        otpHash,
        otpExpiresAt
      }
    });

    const linkUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/client/link?token=${token}`;

    if (email) {
      await this.notificationService.sendEmail(
        email,
        "Seu acesso ao FundarMF",
        this.buildCustomerAccessEmail(linkUrl, otp)
      );
    }

    if (normalizedWhatsapp) {
      if (!this.ensureWhatsAppConfigured()) {
        throw new BadRequestException("WhatsApp não configurado no servidor.");
      }
      await this.notificationService.sendWhatsApp(normalizedWhatsapp, this.buildCustomerAccessWhatsApp(linkUrl, otp));
    }

    await this.auditService.record(
      { role: "SYSTEM" },
      "customer_link_requested",
      "CustomerLinkToken",
      undefined,
      { email, whatsapp: normalizedWhatsapp }
    );

    return { otpRequired: !activeSession };
  }

  async verifyCustomerLink(token: string, otp?: string) {
    const tokenHash = this.hash(token);
    const link = await this.prisma.customerLinkToken.findUnique({ where: { tokenHash } });
    if (!link || link.usedAt || dayjs(link.tokenExpiresAt).isBefore(dayjs())) {
      throw new BadRequestException("Link inválido ou expirado.");
    }

    if (link.otpHash) {
      if (!otp) {
        throw new BadRequestException({ code: "OTP_REQUIRED" });
      }
      if (dayjs(link.otpExpiresAt).isBefore(dayjs())) {
        throw new BadRequestException("OTP expirado.");
      }
      if (this.hash(otp) !== link.otpHash) {
        throw new BadRequestException("OTP inválido.");
      }
    }

    await this.prisma.customerLinkToken.update({
      where: { id: link.id },
      data: { usedAt: new Date() }
    });

    const actor: Actor = { role: "CLIENTE", email: link.email ?? undefined, whatsapp: link.whatsapp ?? undefined };
    const { token: sessionToken } = await this.sessionService.createSession(
      actor,
      Number(process.env.SESSION_TTL_HOURS ?? 48)
    );

    await this.auditService.record(actor, "customer_login", "Session", undefined, {
      email: link.email ?? undefined,
      whatsapp: link.whatsapp ?? undefined
    });

    return { sessionToken };
  }

  async loginUser(email: string, password: string, role: "EMPLOYEE" | "MASTER") {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== role || !user.active) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const actor: Actor = { role: role === "EMPLOYEE" ? "FUNCIONARIO" : "MASTER", userId: user.id, email: user.email };
    const { token } = await this.sessionService.createSession(actor, Number(process.env.SESSION_TTL_HOURS ?? 48));

    await this.auditService.record(actor, "user_login", "Session", undefined, { email: user.email });

    return { token };
  }

  async logout(sessionId?: string, actor?: Actor) {
    if (sessionId) {
      await this.prisma.session.deleteMany({ where: { id: sessionId } });
    }
    await this.auditService.record(actor, "logout", "Session");
  }
}
