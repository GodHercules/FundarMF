import { performance } from "node:perf_hooks";

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { addPerfTime } from "../../shared/request-context";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const start = performance.now();
    const request = context.switchToHttp().getRequest();
    if (!request.actor) {
      addPerfTime("authGuardMs", performance.now() - start);
      throw new UnauthorizedException("Sessão expirada.");
    }
    addPerfTime("authGuardMs", performance.now() - start);
    return true;
  }
}
