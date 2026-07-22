import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { Actor } from "./types";

export const CurrentActor = createParamDecorator((data: unknown, ctx: ExecutionContext): Actor | undefined => {
  const request = ctx.switchToHttp().getRequest();
  return request.actor;
});
