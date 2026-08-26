import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  constructor() {
    super({
      log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }],
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
