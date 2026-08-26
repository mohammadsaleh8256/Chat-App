import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export type Permission =
  | 'VIEW_USERS'
  | 'MANAGE_USERS'
  | 'VIEW_CONVERSATIONS'
  | 'VIEW_MESSAGES'
  | 'VIEW_ATTACHMENTS'
  | 'MANAGE_ADMINS'
  | 'VIEW_AUDIT_LOGS';

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
