import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { safeUser } from '@/lib/serializers';
import { normalizePhone } from '@/server/auth/password';

export const GET = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  let where: Record<string, unknown> = { id: { not: user.id } };
  if (q) {
    const normalized = normalizePhone(q);
    where = {
      ...where,
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: normalized } },
        { phone: { contains: q } },
      ],
    };
  }

  const users = await db.user.findMany({
    where,
    take: limit,
    orderBy: [{ lastSeenAt: 'desc' }],
  });

  return NextResponse.json({ users: users.map(safeUser) });
});
