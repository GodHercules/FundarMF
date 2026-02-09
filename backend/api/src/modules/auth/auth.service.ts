import crypto from "crypto";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { SessionService } from "./session.service";
import { NotificationService } from "../notification/notification.service";
import { AuditService } from "../audit/audit.service";
import { Actor } from "../../common/auth/types";
import { timeAsync } from "../../shared/perf";
import { renderBaseEmail } from "../notification/email.template";

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

  private buildCustomerAccessWhatsApp(linkUrl: string, otp?: string, name?: string) {
    const brand = process.env.WHATSAPP_BRAND ?? process.env.COMPANY_NAME ?? "MF Contabilidade";
    const location = process.env.COMPANY_LOCATION ?? "Bahia, Brazil";
    const linkTtl = Number(process.env.LINK_TTL_HOURS ?? 120);
    const otpTtl = Number(process.env.OTP_TTL_MINUTES ?? 1440);
    return [
      `${brand} | Acesso ao portal`,
      name ? `Olá, ${name}!` : "Olá!",
      location,
      "Seu link de acesso seguro está pronto.",
      `Link: ${linkUrl}`,
      otp ? `Código (OTP): ${otp}` : "Código (OTP): não necessário",
      `Validade do link: ${linkTtl}h.`,
      otp ? `Validade do código: ${otpTtl}min.` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildCustomerAccessEmail(linkUrl: string, otp?: string, name?: string) {
    const linkTtl = Number(process.env.LINK_TTL_HOURS ?? 120);
    const otpTtl = Number(process.env.OTP_TTL_MINUTES ?? 1440);

    const lines = [
      name ? `Olá, ${name},` : "Olá,",
      "",
      "Seu acesso seguro ao portal do cliente FundarMF foi solicitado.",
      "",
      "Siga os passos abaixo:",
      `1) Abra este link: ${linkUrl}`,
      otp ? `2) Informe o código (OTP): ${otp}` : "2) Não é necessário código neste acesso.",
      "",
      `Este link expira em ${linkTtl} horas.`,
      otp ? `O código expira em ${otpTtl} minutos.` : "",
      "",
      "Se você não solicitou este acesso, ignore este e-mail."
    ].filter(Boolean);

    return lines.join("\n");
  }

  async requestCustomerLink(
    email?: string,
    whatsapp?: string,
    name?: string,
    requestedBy?: { email?: string; role?: string }
  ) {
    if (!email && !whatsapp) {
      throw new BadRequestException("Informe e-mail ou WhatsApp.");
    }

    const normalizedWhatsapp = whatsapp ? this.normalizeWhatsApp(whatsapp) : undefined;

    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = this.hash(token);
    const tokenExpiresAt = dayjs().add(Number(process.env.LINK_TTL_HOURS ?? 120), "hour").toDate();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = this.hash(otp);
    const otpExpiresAt = dayjs().add(Number(process.env.OTP_TTL_MINUTES ?? 1440), "minute").toDate();

    await this.prisma.customerLinkToken.create({
      data: {
        email,
        whatsapp: normalizedWhatsapp,
        tokenHash,
        tokenExpiresAt,
        otpHash,
        otpExpiresAt,
        otpSentCount: 1,
        lastOtpSentAt: new Date()
      }
    });

    const linkUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/client/link?token=${token}`;

    const notifyTasks: Promise<unknown>[] = [];
    if (email) {
      const subject = "Seu acesso ao FundarMF";
      const emailText = this.buildCustomerAccessEmail(linkUrl, otp, name);
      const emailRendered = renderBaseEmail({
        title: subject,
        body: emailText,
        ctaLabel: "Abrir acesso",
        ctaUrl: linkUrl
      });
      notifyTasks.push(
        this.notificationService.sendEmail(email, subject, emailText)
      );
      // Attach the exact draft to the webhook too, so n8n can send it if desired.
      void this.notificationService.sendWebhook({
        email,
        whatsapp: normalizedWhatsapp,
        link: linkUrl,
        otp,
        reason: "link_created",
        requestedBy,
        emails: {
          client: {
            target: "client",
            to: email,
            subject,
            text: emailRendered.text,
            html: emailRendered.html
          }
        }
      });
    }
    if (normalizedWhatsapp) {
      notifyTasks.push(
        this.notificationService.sendWhatsApp(
          normalizedWhatsapp,
          this.buildCustomerAccessWhatsApp(linkUrl, otp, name)
        )
      );
    }
    if (notifyTasks.length > 0) {
      await Promise.all(notifyTasks);
    }

    if (!email) {
      // If there's no email, still notify webhook with link + otp metadata.
      void this.notificationService.sendWebhook({
        email,
        whatsapp: normalizedWhatsapp,
        link: linkUrl,
        otp,
        reason: "link_created",
        requestedBy
      });
    }

    await this.auditService.record(
      { role: "SYSTEM" },
      "customer_link_requested",
      "CustomerLinkToken",
      undefined,
      { email, whatsapp: normalizedWhatsapp }
    );

    return { otpRequired: true };
  }

  async verifyCustomerLink(token: string, otp?: string) {
    const tokenHash = this.hash(token);
    const link = await this.prisma.customerLinkToken.findUnique({ where: { tokenHash } });
    if (!link || link.usedAt || dayjs(link.tokenExpiresAt).isBefore(dayjs())) {
      throw new BadRequestException({ code: "LINK_INVALID" });
    }

    if (link.otpHash) {
      if (!otp) {
        throw new BadRequestException({ code: "OTP_REQUIRED" });
      }
      if (dayjs(link.otpExpiresAt).isBefore(dayjs())) {
        throw new BadRequestException({ code: "OTP_EXPIRED" });
      }
      if (this.hash(otp) !== link.otpHash) {
        throw new BadRequestException({ code: "OTP_INVALID" });
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

  async resendCustomerOtp(token: string) {
    const tokenHash = this.hash(token);
    const link = await this.prisma.customerLinkToken.findUnique({ where: { tokenHash } });
    if (!link || link.usedAt || dayjs(link.tokenExpiresAt).isBefore(dayjs())) {
      throw new BadRequestException({ code: "LINK_INVALID" });
    }
    if (!link.email) {
      throw new BadRequestException("E-mail não disponível para reenvio do OTP.");
    }
    if (link.otpSentCount >= 5) {
      throw new BadRequestException({ code: "OTP_LIMIT_REACHED" });
    }
    if (link.lastOtpSentAt && dayjs().diff(dayjs(link.lastOtpSentAt), "hour") < 24) {
      throw new BadRequestException({ code: "OTP_TOO_SOON" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = this.hash(otp);
    const otpExpiresAt = dayjs().add(Number(process.env.OTP_TTL_MINUTES ?? 1440), "minute").toDate();

    await this.prisma.customerLinkToken.update({
      where: { id: link.id },
      data: {
        otpHash,
        otpExpiresAt,
        otpSentCount: link.otpSentCount + 1,
        lastOtpSentAt: new Date()
      }
    });

    const linkUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/client/link?token=${token}`;
    const subject = "Seu novo OTP do FundarMF";
    const emailText = this.buildCustomerAccessEmail(linkUrl, otp);
    const emailRendered = renderBaseEmail({
      title: subject,
      body: emailText,
      ctaLabel: "Abrir acesso",
      ctaUrl: linkUrl
    });
    await this.notificationService.sendEmail(link.email, subject, emailText);

    void this.notificationService.sendWebhook({
      email: link.email,
      whatsapp: link.whatsapp ?? undefined,
      link: linkUrl,
      otp,
      reason: "otp_resent",
      requestedBy: { email: link.email ?? undefined, role: "CLIENTE" },
      emails: {
        client: {
          target: "client",
          to: link.email,
          subject,
          text: emailRendered.text,
          html: emailRendered.html
        }
      }
    });

    await this.auditService.record(
      { role: "SYSTEM" },
      "customer_otp_resent",
      "CustomerLinkToken",
      link.id,
      { email: link.email }
    );

    return { ok: true };
  }

  async loginUser(email: string, password: string, role: "OPERATOR" | "MASTER") {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== role || !user.active) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const ok = await timeAsync("hashMs", () => bcrypt.compare(password, user.passwordHash));
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const actor: Actor = { role: role === "OPERATOR" ? "OPERADOR" : "MASTER", userId: user.id, email: user.email };
    const { token } = await this.sessionService.createSession(actor, Number(process.env.SESSION_TTL_HOURS ?? 48));

    await this.auditService.record(actor, "user_login", "Session", undefined, { email: user.email });

    return { token };
  }

  async loginAny(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const ok = await timeAsync("hashMs", () => bcrypt.compare(password, user.passwordHash));
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const actor: Actor = {
      role: user.role === "OPERATOR" ? "OPERADOR" : "MASTER",
      userId: user.id,
      email: user.email
    };
    const { token } = await this.sessionService.createSession(actor, Number(process.env.SESSION_TTL_HOURS ?? 48));

    await this.auditService.record(actor, "user_login", "Session", undefined, { email: user.email });

    return { token, role: user.role };
  }

  async logout(sessionId?: string, actor?: Actor) {
    if (sessionId) {
      await this.prisma.session.deleteMany({ where: { id: sessionId } });
    }
    await this.auditService.record(actor, "logout", "Session");
  }
}






