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
import { IdempotencyService } from "../../shared/idempotency.service";
import { IdempotencyScope } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService
  ) {}

  private shouldSendAuthWebhook() {
    return (process.env.N8N_WEBHOOK_AUTH_ENABLED ?? "false").trim().toLowerCase() === "true";
  }

  private linkDedupSeconds() {
    const raw = Number(process.env.LINK_REQUEST_DEDUP_SECONDS ?? 30);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(raw, 10 * 60);
  }

  private otpResendCooldownMinutes() {
    const raw = Number(process.env.OTP_RESEND_COOLDOWN_MINUTES ?? 1);
    if (!Number.isFinite(raw) || raw < 0) return 1;
    return Math.min(raw, 24 * 60);
  }

  private assertOtpResendCooldown(lastOtpSentAt?: Date | null) {
    const cooldownMinutes = this.otpResendCooldownMinutes();
    if (!lastOtpSentAt || cooldownMinutes <= 0) return;

    const nextAllowedAt = dayjs(lastOtpSentAt).add(cooldownMinutes, "minute");
    if (dayjs().isBefore(nextAllowedAt)) {
      throw new BadRequestException({ code: "OTP_TOO_SOON" });
    }
  }

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
    requestedBy?: { email?: string; role?: string },
    options?: { forceNew?: boolean; idempotencyKey?: string }
  ): Promise<{ otpRequired: boolean; deduped?: boolean }> {
    if (!email && !whatsapp) {
      throw new BadRequestException("Informe e-mail ou WhatsApp.");
    }

    const normalizedWhatsapp = whatsapp ? this.normalizeWhatsApp(whatsapp) : undefined;

    if (!options?.forceNew && options?.idempotencyKey) {
      const result = await this.idempotencyService.execute<{ otpRequired: boolean; deduped?: boolean }>(
        IdempotencyScope.CUSTOMER_LINK_REQUEST,
        options.idempotencyKey,
        { email, whatsapp: normalizedWhatsapp, name, requestedBy },
        async () =>
          this.requestCustomerLink(email, normalizedWhatsapp, name, requestedBy, {
            forceNew: true
          }),
        900
      );
      return result.data;
    }

    // Deduplicate near-simultaneous requests (double-clicks, retries, accidental double submits).
    // This ensures the client receives only one link+OTP unless an explicit resend is requested.
    const dedupSeconds = this.linkDedupSeconds();
    if (!options?.forceNew && dedupSeconds > 0) {
      const since = dayjs().subtract(dedupSeconds, "second").toDate();
      const existing = await this.prisma.customerLinkToken.findFirst({
        where: {
          usedAt: null,
          tokenExpiresAt: { gt: new Date() },
          createdAt: { gt: since },
          ...(email && normalizedWhatsapp
            ? { email, whatsapp: normalizedWhatsapp }
            : email
              ? { email }
              : normalizedWhatsapp
                ? { whatsapp: normalizedWhatsapp }
                : {})
        },
        orderBy: { createdAt: "desc" }
      });
      if (existing) {
        await this.auditService.record(
          { role: "SYSTEM" },
          "customer_link_requested_deduped",
          "CustomerLinkToken",
          existing.id,
          { email, whatsapp: normalizedWhatsapp, dedupSeconds }
        );
        return { otpRequired: true, deduped: true };
      }
    }

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
      // Avoid double-delivery: in some setups n8n also sends the email/whatsapp when it receives the webhook.
      // Enable this only if you want webhook mirroring for auth events.
      if (this.shouldSendAuthWebhook()) {
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
      void Promise.all(notifyTasks).catch((err) => {
        console.error("[auth] requestCustomerLink notify failed", err);
      });
    }

    if (!email) {
      // If there's no email, still notify webhook with link + otp metadata.
      if (this.shouldSendAuthWebhook()) {
        void this.notificationService.sendWebhook({
          email,
          whatsapp: normalizedWhatsapp,
          link: linkUrl,
          otp,
          reason: "link_created",
          requestedBy
        });
      }
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

  async resendCustomerOtpByEmail(email: string, requestedBy?: { email?: string; role?: string }) {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      throw new BadRequestException("E-mail inválido para reenvio do OTP.");
    }

    const link = await this.prisma.customerLinkToken.findFirst({
      where: {
        email: normalizedEmail,
        usedAt: null,
        tokenExpiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!link) {
      throw new BadRequestException({ code: "LINK_INVALID" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = this.hash(otp);
    const otpExpiresAt = dayjs().add(Number(process.env.OTP_TTL_MINUTES ?? 1440), "minute").toDate();

    const updatedLink = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CustomerLinkToken" WHERE id = ${link.id} FOR UPDATE`;
      const locked = await tx.customerLinkToken.findUnique({ where: { id: link.id } });
      if (!locked || locked.usedAt || dayjs(locked.tokenExpiresAt).isBefore(dayjs())) {
        throw new BadRequestException({ code: "LINK_INVALID" });
      }
      if (locked.otpSentCount >= 5) {
        throw new BadRequestException({ code: "OTP_LIMIT_REACHED" });
      }
      this.assertOtpResendCooldown(locked.lastOtpSentAt);

      return tx.customerLinkToken.update({
        where: { id: locked.id },
        data: {
          otpHash,
          otpExpiresAt,
          otpSentCount: { increment: 1 },
          lastOtpSentAt: new Date()
        }
      });
    });

    const subject = "Seu novo OTP do FundarMF";
    const emailText = [
      "Olá,",
      "",
      "Seu novo código de acesso (OTP) foi gerado.",
      `Código (OTP): ${otp}`,
      "",
      "Use o mesmo link recebido anteriormente para entrar no portal.",
      "Se você não solicitou este código, ignore este e-mail."
    ].join("\n");

    void this.notificationService.sendEmail(updatedLink.email!, subject, emailText);

    if (this.shouldSendAuthWebhook()) {
      void this.notificationService.sendWebhook({
        email: updatedLink.email ?? undefined,
        whatsapp: updatedLink.whatsapp ?? undefined,
        otp,
        reason: "otp_resent_by_operator",
        requestedBy
      });
    }

    await this.auditService.record(
      { role: "SYSTEM" },
      "customer_otp_resent_by_operator",
      "CustomerLinkToken",
      updatedLink.id,
      { email: updatedLink.email, requestedBy }
    );

    return { ok: true };
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

    const consume = await this.prisma.customerLinkToken.updateMany({
      where: {
        id: link.id,
        usedAt: null,
        tokenExpiresAt: { gt: new Date() }
      },
      data: { usedAt: new Date() }
    });
    if (consume.count === 0) {
      throw new BadRequestException({ code: "LINK_INVALID" });
    }

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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = this.hash(otp);
    const otpExpiresAt = dayjs().add(Number(process.env.OTP_TTL_MINUTES ?? 1440), "minute").toDate();

    const updatedLink = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CustomerLinkToken" WHERE id = ${link.id} FOR UPDATE`;
      const locked = await tx.customerLinkToken.findUnique({ where: { id: link.id } });
      if (!locked || locked.usedAt || dayjs(locked.tokenExpiresAt).isBefore(dayjs())) {
        throw new BadRequestException({ code: "LINK_INVALID" });
      }
      if (!locked.email) {
        throw new BadRequestException("E-mail não disponível para reenvio do OTP.");
      }
      if (locked.otpSentCount >= 5) {
        throw new BadRequestException({ code: "OTP_LIMIT_REACHED" });
      }
      this.assertOtpResendCooldown(locked.lastOtpSentAt);

      return tx.customerLinkToken.update({
        where: { id: locked.id },
        data: {
          otpHash,
          otpExpiresAt,
          otpSentCount: { increment: 1 },
          lastOtpSentAt: new Date()
        }
      });
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
    void this.notificationService.sendEmail(updatedLink.email!, subject, emailText);

    if (this.shouldSendAuthWebhook()) {
      void this.notificationService.sendWebhook({
        email: updatedLink.email ?? undefined,
        whatsapp: updatedLink.whatsapp ?? undefined,
        link: linkUrl,
        otp,
        reason: "otp_resent",
        requestedBy: { email: updatedLink.email ?? undefined, role: "CLIENTE" },
        emails: {
          client: {
            target: "client",
            to: updatedLink.email!,
            subject,
            text: emailRendered.text,
            html: emailRendered.html
          }
        }
      });
    }

    await this.auditService.record(
      { role: "SYSTEM" },
      "customer_otp_resent",
      "CustomerLinkToken",
      updatedLink.id,
      { email: updatedLink.email }
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






