import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { safeUser } from '@/lib/serializers';
import { recordAudit, getRequestIp } from '@/server/audit';

export const GET = withErrorHandler(async (req: Request) => {
  const admin = await requireAdmin();

  await recordAudit({
    actorId: admin.id,
    action: 'VIEW_USER_LIST',
    targetType: 'USER',
    ipAddress: getRequestIp(req),
  });

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ users: users.map(safeUser) });
});
