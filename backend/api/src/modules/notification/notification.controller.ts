import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { NotificationService } from "./notification.service";
import { TestEmailDto, TestWhatsAppDto } from "./notification-test.dto";

@Controller("notifications")
@UseGuards(AuthGuard, RolesGuard)
@Roles("OPERADOR", "MASTER")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@Req() req: Request, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    const take = limit ? Number(limit) : undefined;
    const skip = offset ? Number(offset) : undefined;
    return this.notificationService.listInApp(req.actor!.userId!, take, skip);
  }

  @Get("unread-count")
  async unread(@Req() req: Request) {
    const count = await this.notificationService.unreadCount(req.actor!.userId!);
    return { count };
  }

  @Patch(":id/read")
  async markRead(@Param("id") id: string, @Req() req: Request) {
    return this.notificationService.markRead(req.actor!.userId!, id);
  }

  @Patch(":id/dismiss")
  async dismiss(@Param("id") id: string, @Req() req: Request) {
    return this.notificationService.dismiss(req.actor!.userId!, id);
  }

  @Post("test-email")
  @Roles("MASTER")
  async sendTestEmail(@Body() dto: TestEmailDto) {
    await this.notificationService.sendEmail(dto.to, dto.subject, dto.body);
    return { ok: true };
  }

  @Post("test-whatsapp")
  @Roles("MASTER")
  async sendTestWhatsApp(@Body() dto: TestWhatsAppDto) {
    await this.notificationService.sendWhatsApp(dto.to, dto.body);
    return { ok: true };
  }
}
