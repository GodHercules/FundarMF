import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { performance } from "node:perf_hooks";
import { addPerfTime } from "../../shared/request-context";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const start = performance.now();
    const request = context.switchToHttp().getRequest();
    const result = Boolean(request.actor);
    addPerfTime("authGuardMs", performance.now() - start);
    return result;
  }
}
