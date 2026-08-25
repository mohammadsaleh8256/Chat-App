import { NextResponse } from 'next/server';
import { destroySession } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';

export const POST = withErrorHandler(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
