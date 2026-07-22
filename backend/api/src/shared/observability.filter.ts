import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

import { ErrorObservabilityService } from "./error-observability.service";
import { getRequestContext } from "./request-context";

@Catch()
export class ObservabilityExceptionFilter implements ExceptionFilter {
  constructor(private readonly observability: ErrorObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { actor?: { userId?: string } }>();
    const response = http.getResponse<Response>();
    const statusCode = response.statusCode >= 500 ? response.statusCode : this.statusOf(exception);
    if (statusCode >= 500) {
      void this.observability.capture(exception, {
        category: "http",
        operation: `${request.method} ${request.route?.path ?? request.path}`,
        request: { method: request.method, route: request.route?.path ?? request.path, url: request.originalUrl, statusCode, requestId: getRequestContext()?.correlationId, userId: request.actor?.userId ?? null, ip: request.ip }
      });
    }
    response.status(statusCode).json(this.responseBody(exception, statusCode));
  }

  private statusOf(exception: unknown) {
    if (typeof exception === "object" && exception !== null && "getStatus" in exception && typeof (exception as { getStatus?: unknown }).getStatus === "function") return Number((exception as { getStatus: () => number }).getStatus());
    return 500;
  }

  private responseBody(exception: unknown, statusCode: number) {
    if (statusCode < 500 && typeof exception === "object" && exception !== null && "getResponse" in exception && typeof (exception as { getResponse?: unknown }).getResponse === "function") return (exception as { getResponse: () => unknown }).getResponse();
    return { statusCode, message: statusCode >= 500 ? "Internal server error" : "Request failed" };
  }
}
