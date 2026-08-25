import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, normalizePhone } from '@/server/auth/password';
import { createSession } from '@/server/auth/session';
import { loginSchema } from '@/server/auth/validation';
import { withErrorHandler, parseOrThrow } from '@/lib/api-helpers';

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(loginSchema, body);

  const phone = normalizePhone(input.phone);
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    throw new Error('BAD_REQUEST:شماره یا رمز عبور نادرست است');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('BAD_REQUEST:شماره یا رمز عبور نادرست است');
  }

  await createSession({
    userId: user.id,
    userAgent: req.headers.get('user-agent') || undefined,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim(),
  });

  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  });
});
