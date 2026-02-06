import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ActorRole } from "./types";
import { performance } from "node:perf_hooks";
import { addPerfTime } from "../../shared/request-context";

export const ROLES_KEY = "roles";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const start = performance.now();
    const roles = this.reflector.getAllAndOverride<ActorRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!roles || roles.length === 0) {
      addPerfTime("rolesGuardMs", performance.now() - start);
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actor = request.actor;
    if (!actor) {
      addPerfTime("rolesGuardMs", performance.now() - start);
      return false;
    }

    const result = roles.includes(actor.role);
    addPerfTime("rolesGuardMs", performance.now() - start);
    return result;
  }
}
