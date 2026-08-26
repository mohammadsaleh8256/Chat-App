import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminController } from './admin.controller';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  providers: [AdminService, PermissionsGuard],
  controllers: [AdminController],
})
export class AdminModule {}
