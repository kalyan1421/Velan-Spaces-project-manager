import { SetMetadata } from '@nestjs/common';
import { AppRole } from '../types/authenticated-user';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given app roles. Enforced by RolesGuard. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
