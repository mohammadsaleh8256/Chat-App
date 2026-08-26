import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger('SeedService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async seedInitialSettings() {
    // Upsert the admin-phone setting if missing
    const adminPhone = this.config.get<string>('INITIAL_ADMIN_PHONE', '09162744975');
    await this.prisma.appSetting.upsert({
      where: { key: 'INITIAL_ADMIN_PHONE' },
      update: {},
      create: {
        key: 'INITIAL_ADMIN_PHONE',
        value: this.normalizePhone(adminPhone),
        description: 'Phone number of the initial admin user (granted ADMIN role on first registration).',
      },
    });
    this.logger.log(`Initial admin phone seeded: ${adminPhone}`);
  }

  async ensureAdminPhoneSetting() {
    // Always ensure the setting exists at startup
    const existing = await this.prisma.appSetting.findUnique({
      where: { key: 'INITIAL_ADMIN_PHONE' },
    });
    if (!existing) {
      await this.seedInitialSettings();
    }
  }

  /**
   * Normalize Iranian phone number to E.164.
   * 09162744975 -> +989162744975
   * +989162744975 -> +989162744975
   * 00989162744975 -> +989162744975
   */
  normalizePhone(raw: string): string {
    if (!raw) throw new Error('Phone number is required.');
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('09'))
      return '+98' + digits.slice(1);
    if (digits.length === 10 && digits.startsWith('9'))
      return '+98' + digits;
    if (digits.length === 12 && digits.startsWith('98'))
      return '+' + digits;
    if (digits.length === 14 && digits.startsWith('0098'))
      return '+' + digits.slice(2);
    if (digits.length === 13 && digits.startsWith('098'))
      return '+' + digits.slice(1);
    throw new Error(`Invalid phone number: ${raw}`);
  }
}
