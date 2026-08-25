import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/server/auth/session';
import { withErrorHandler, parseOrThrow } from '@/lib/api-helpers';
import { recordAudit, getRequestIp } from '@/server/audit';
import { z } from 'zod';

const updateAdminPhoneSchema = z.object({
  phone: z.string().min(1),
});

/**
 * GET - returns all admin settings.
 */
export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const settings = await db.adminSetting.findMany({
    include: { updatedBy: true },
  });
  return NextResponse.json({
    settings: settings.map((s) => ({
      key: s.key,
      value: s.value,
      updatedAt: s.updatedAt.toISOString(),
      updatedBy: s.updatedBy
        ? `${s.updatedBy.firstName} ${s.updatedBy.lastName}`
        : null,
    })),
  });
});

/**
 * PATCH - update initial_admin_phone (configurable admin phone).
 * Admin phone is read from DB, never hardcoded in source.
 */
export const PATCH = withErrorHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(updateAdminPhoneSchema, body);

  // Normalize phone
  const normalized = input.phone.replace(/[^\d]/g, '').replace(/^(0098|98|0)/, '0');
  if (!/^09\d{9}$/.test(normalized)) {
    throw new Error('BAD_REQUEST:شماره موبایل نامعتبر است');
  }

  // Find or create the new admin user
  const existing = await db.user.findUnique({ where: { phone: normalized } });
  if (existing && existing.role !== 'ADMIN') {
    await db.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN' },
    });
  }

  // Update setting
  await db.adminSetting.upsert({
    where: { key: 'initial_admin_phone' },
    update: { value: normalized, updatedById: admin.id },
    create: { key: 'initial_admin_phone', value: normalized, updatedById: admin.id },
  });

  await recordAudit({
    actorId: admin.id,
    action: 'UPDATE_ADMIN_PHONE',
    targetType: 'USER',
    targetId: existing?.id,
    metadata: { newPhone: normalized },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ ok: true, phone: normalized });
});
