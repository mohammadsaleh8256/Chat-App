import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ensure the INITIAL_ADMIN_PHONE setting exists
  const adminPhone = process.env.INITIAL_ADMIN_PHONE || '09162744975';
  // Normalize
  const digits = adminPhone.replace(/\D/g, '');
  let normalized: string;
  if (digits.length === 11 && digits.startsWith('09')) normalized = '+98' + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('9')) normalized = '+98' + digits;
  else if (digits.length === 12 && digits.startsWith('98')) normalized = '+' + digits;
  else if (digits.length === 14 && digits.startsWith('0098')) normalized = '+' + digits.slice(2);
  else normalized = '+' + digits;

  await prisma.appSetting.upsert({
    where: { key: 'INITIAL_ADMIN_PHONE' },
    update: {},
    create: {
      key: 'INITIAL_ADMIN_PHONE',
      value: normalized,
      description: 'Phone number of the initial admin user (granted ADMIN role on first registration).',
    },
  });
  console.log(`Initial admin phone seeded: ${adminPhone} -> ${normalized}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
