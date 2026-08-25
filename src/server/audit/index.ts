import { db } from '@/lib/db';
import type { AuditAction, AuditTargetType } from '@prisma/client';

interface AuditInput {
  actorId: string;
  action: AuditAction;
  targetUserId?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Record an admin audit log entry.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      targetUserId: input.targetUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ipAddress: input.ipAddress,
    },
  });
}

/**
 * Get IP from request headers (best-effort).
 */
export function getRequestIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  return real || undefined;
}
