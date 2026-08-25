import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const last5Min = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsers = await db.user.findMany({
    where: { lastSeenAt: { gt: last5Min }, id: { not: user.id } },
    select: { id: true, lastSeenAt: true },
  });

  return NextResponse.json({
    presence: onlineUsers.map((u) => ({
      userId: u.id,
      isOnline: true,
      lastSeenAt: u.lastSeenAt.toISOString(),
    })),
  });
});
