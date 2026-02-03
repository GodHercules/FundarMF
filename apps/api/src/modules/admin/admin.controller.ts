import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Response, Request } from "express";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { AdminService } from "./admin.service";
import { CreateUserDto } from "./create-user.dto";
import { AssignOwnerDto } from "./assign-owner.dto";

@Controller("admin")
@UseGuards(AuthGuard, RolesGuard)
@Roles("MASTER")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Post("users")
  async createUser(@Body() dto: CreateUserDto, @Req() req: Request) {
    return this.adminService.createOperator(dto.email, dto.name, dto.password, dto.whatsapp);
  }

  @Post("processes/:id/assign")
  async assign(@Param("id") id: string, @Body() dto: AssignOwnerDto, @Req() req: Request) {
    return this.adminService.assignOwner(id, dto.ownerId, req.actor?.userId);
  }

  @Get("processes/unassigned")
  async unassigned() {
    return this.adminService.listUnassigned();
  }

  @Get("audit")
  async audit() {
    return this.adminService.listAudit();
  }

  @Get("reports/:processId")
  async report(@Param("processId") processId: string, @Res() res: Response) {
    const report = await this.adminService.getReport(processId);
    res.setHeader("Content-Type", report.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${report.fileName}\"`);
    res.send(report.data);
  }
}
