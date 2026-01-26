import { SetMetadata } from "@nestjs/common";
import { ActorRole } from "./types";
import { ROLES_KEY } from "./roles.guard";

export const Roles = (...roles: ActorRole[]) => SetMetadata(ROLES_KEY, roles);
