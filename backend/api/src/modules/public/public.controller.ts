import { Controller, Get } from "@nestjs/common";
import { PublicService } from "./public.service";

@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("metrics")
  async metrics() {
    return this.publicService.getMetrics();
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
