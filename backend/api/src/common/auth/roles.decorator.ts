import { SetMetadata } from "@nestjs/common";

import { ROLES_KEY } from "./roles.guard";
import { ActorRole } from "./types";

export const Roles = (...roles: ActorRole[]) => SetMetadata(ROLES_KEY, roles);
