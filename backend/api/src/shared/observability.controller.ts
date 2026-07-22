import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { ErrorObservabilityService } from "./error-observability.service";

class FrontendErrorDto {
  @IsString()
  @MaxLength(2_000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  operation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}

@Controller("observability")
export class ObservabilityController {
  constructor(private readonly observability: ErrorObservabilityService) {}

  @Post("frontend")
  async frontend(@Body() dto: FrontendErrorDto) {
    await this.observability.captureFrontendEvent(dto);
    return { ok: true };
  }

  @Post("test")
  async controlledTest() {
    if (process.env.NODE_ENV === "production" || process.env.ERROR_WEBHOOK_TEST_ENABLED !== "true") throw new NotFoundException();
    await this.observability.capture(new Error("Controlled observability test event"), {
      service: "api", processType: "api", category: "runtime", operation: "controlled_test",
      additionalData: { controlled: true }
    });
    return { ok: true };
  }
}
