import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { auditLogToPublic } from '@/lib/serializers';

export const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const cursor = url.searchParams.get('cursor');

  const logs = await db.adminAuditLog.findMany({
    where: cursor ? { createdAt: { lt: new Date(cursor) } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: true, target: true },
  });

  return NextResponse.json({
    logs: logs.map(auditLogToPublic),
    nextCursor:
      logs.length === limit ? logs[logs.length - 1].createdAt.toISOString() : null,
  });
});
