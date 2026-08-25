/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

function normalizePhone(phone) {
  let p = phone.replace(/[^\d]/g, '');
  if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98')) p = '0' + p.slice(2);
  else if (!p.startsWith('0')) p = '0' + p;
  return p;
}

async function main() {
  const adminPhone = process.env.INITIAL_ADMIN_PHONE;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@12345';
  const adminFirst = process.env.INITIAL_ADMIN_FIRST_NAME || 'Admin';
  const adminLast = process.env.INITIAL_ADMIN_LAST_NAME || 'User';

  if (!adminPhone) {
    throw new Error('INITIAL_ADMIN_PHONE environment variable is required for seeding');
  }

  const normalized = normalizePhone(adminPhone);
  console.log('[seed] Creating initial admin with phone:', normalized);

  const existing = await db.user.findUnique({ where: { phone: normalized } });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await db.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN' },
      });
      console.log('[seed] Updated existing user to ADMIN role');
    } else {
      console.log('[seed] Admin already exists:', normalized);
    }
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.user.create({
      data: {
        firstName: adminFirst,
        lastName: adminLast,
        phone: normalized,
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log('[seed] Created initial admin:', normalized);
  }

  await db.adminSetting.upsert({
    where: { key: 'initial_admin_phone' },
    update: {},
    create: {
      key: 'initial_admin_phone',
      value: normalized,
    },
  });
  console.log('[seed] Done.');
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
