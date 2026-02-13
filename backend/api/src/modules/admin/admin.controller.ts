import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Response, Request } from "express";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { AdminService } from "./admin.service";
import { CreateUserDto } from "./create-user.dto";
import { AssignOwnerDto } from "./assign-owner.dto";
import { DeleteProcessDto } from "./delete-process.dto";

@Controller("admin")
@UseGuards(AuthGuard, RolesGuard)
@Roles("MASTER")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  async listUsers(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.adminService.listUsers(limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  }

  @Post("users")
  async createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createOperator(dto.email, dto.name, dto.password, dto.whatsapp);
  }

  @Delete("users/:id")
  async deleteUser(@Param("id") id: string, @Req() req: Request) {
    return this.adminService.deleteOperator(id, req.actor?.userId);
  }

  @Post("processes/:id/assign")
  async assign(@Param("id") id: string, @Body() dto: AssignOwnerDto, @Req() req: Request) {
    return this.adminService.assignOwner(id, dto.ownerId, req.actor?.userId);
  }

  @Delete("processes/:id")
  async deleteProcess(@Param("id") id: string, @Body() dto: DeleteProcessDto, @Req() req: Request) {
    return this.adminService.deleteProcess(id, req.actor?.userId, dto.reason);
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
    res.setHeader("Content-Disposition", `attachment; filename="${report.fileName}"`);
    res.send(report.data);
  }
}
