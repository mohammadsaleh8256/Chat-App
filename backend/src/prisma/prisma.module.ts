import { Global, Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';

@Global()
@Module({
  providers: [PrismaService, SeedService],
  exports: [PrismaService, SeedService],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const logger = new Logger('Prisma');
    try {
      await this.prisma.$connect();
      logger.log('Connected to SQLite database');
    } catch (err) {
      logger.error('Failed to connect to database', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
