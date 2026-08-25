import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, normalizePhone } from '@/server/auth/password';
import { createSession } from '@/server/auth/session';
import { registerSchema } from '@/server/auth/validation';
import { withErrorHandler, parseOrThrow } from '@/lib/api-helpers';

export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(registerSchema, body);

  const phone = normalizePhone(input.phone);
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    throw new Error('CONFLICT:این شماره قبلاً ثبت‌نام کرده است');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone,
      passwordHash,
    },
  });

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
