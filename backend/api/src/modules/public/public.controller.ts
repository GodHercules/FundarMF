import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { AuthGuard } from "../../common/auth/auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { PublicService } from "./public.service";

@Controller()
export class RootController {
  @Get()
  root() {
    return { ok: true, service: "FundarMF API", ts: Date.now() };
  }
}

@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("metrics")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("OPERADOR", "MASTER")
  async metrics(@Req() req: Request) {
    return this.publicService.getMetrics(req.actor?.tenantKey ?? "default");
  }

  @Get("health")
  health() {
    return { ok: true, ts: Date.now() };
  }

  @Get("municipalities")
  async municipalities() {
    return this.publicService.getMunicipalities();
  }
}
