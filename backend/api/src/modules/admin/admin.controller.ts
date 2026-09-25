import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Request,Response } from "express";

import { AuthGuard } from "../../common/auth/auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { AdminService } from "./admin.service";
import { AssignOwnerDto } from "./assign-owner.dto";
import { CreateUserDto } from "./create-user.dto";
import { DeleteProcessDto } from "./delete-process.dto";

@Controller("admin")
@UseGuards(AuthGuard, RolesGuard)
@Roles("MASTER")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  async listUsers(@Req() req: Request, @Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.adminService.listUsers(req.actor!, limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
  }

  @Post("users")
  async createUser(@Req() req: Request, @Body() dto: CreateUserDto) {
    return this.adminService.createOperator(dto.email, dto.name, dto.password, dto.whatsapp, req.actor);
  }

  @Delete("users/:id")
  async deleteUser(@Param("id") id: string, @Req() req: Request) {
    return this.adminService.deleteOperator(id, req.actor?.userId, req.actor?.tenantKey ?? "default");
  }

  @Post("processes/:id/assign")
  async assign(@Param("id") id: string, @Body() dto: AssignOwnerDto, @Req() req: Request) {
    return this.adminService.assignOwner(id, dto.ownerId, req.actor?.userId, req.actor?.tenantKey ?? "default");
  }

  @Delete("processes/:id")
  async deleteProcess(@Param("id") id: string, @Body() dto: DeleteProcessDto, @Req() req: Request) {
    return this.adminService.deleteProcess(id, req.actor?.userId, dto.reason, req.actor?.tenantKey ?? "default");
  }

  @Get("processes/unassigned")
  async unassigned(@Req() req: Request) {
    return this.adminService.listUnassigned(req.actor?.tenantKey ?? "default");
  }

  @Get("audit")
  async audit(@Req() req: Request) {
    return this.adminService.listAudit(req.actor?.tenantKey ?? "default");
  }

  @Get("reports/:processId")
  async report(@Param("processId") processId: string, @Req() req: Request, @Res() res: Response) {
    const report = await this.adminService.getReport(processId, req.actor?.tenantKey ?? "default");
    res.setHeader("Content-Type", report.mimeType);
    const fileName = [...report.fileName]
      .map((character) => {
        const code = character.charCodeAt(0);
        return character === '"' || character === "\\" || code <= 31 || code === 127 ? "_" : character;
      })
      .join("")
      .slice(0, 180) || "report";
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(report.data);
  }
}
