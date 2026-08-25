import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';

/**
 * Returns the session token so the WebSocket mini-service can authenticate.
 * The token is the same as the cookie value (which is httpOnly).
 */
export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.SESSION_COOKIE_NAME || 'messenger_session')?.value;
  if (!token) throw new Error('UNAUTHORIZED');
  return NextResponse.json({ token });
});
