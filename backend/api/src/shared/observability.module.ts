import { Global, Module } from "@nestjs/common";

import { ErrorObservabilityService } from "./error-observability.service";
import { ObservabilityController } from "./observability.controller";

@Global()
@Module({ controllers: [ObservabilityController], providers: [ErrorObservabilityService], exports: [ErrorObservabilityService] })
export class ObservabilityModule {}
