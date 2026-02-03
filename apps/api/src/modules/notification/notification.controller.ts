import { Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { NotificationService } from "./notification.service";

@Controller("notifications")
@UseGuards(AuthGuard, RolesGuard)
@Roles("OPERADOR", "MASTER")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.notificationService.listInApp(req.actor!.userId!);
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
}
