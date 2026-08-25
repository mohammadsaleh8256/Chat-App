import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { safeUser } from '@/lib/serializers';

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const users = await db.user.findMany({
    where: { id: { not: user.id } },
    take: 50,
    orderBy: [{ lastSeenAt: 'desc' }],
  });

  return NextResponse.json({ users: users.map(safeUser) });
});
