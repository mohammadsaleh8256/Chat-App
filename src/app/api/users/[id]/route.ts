import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { safeUser } from '@/lib/serializers';

export const GET = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const found = await db.user.findUnique({ where: { id } });
  if (!found) throw new Error('NOT_FOUND:کاربر یافت نشد');

  return NextResponse.json({ user: safeUser(found) });
});
