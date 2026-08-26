import { Body, Controller, Get, Param, Put, Query, UseGuards, Ip, Post, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './services/admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  AdminListUsersQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpdateAdminPhoneDto,
  AdminListConversationsQueryDto,
  AdminListMessagesQueryDto,
  AdminSearchMessagesQueryDto,
  AdminAuditLogsQueryDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Helper — only allow ADMIN role to access admin endpoints. */
  private assertAdmin(user: CurrentUserPayload) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('دسترسی غیرمجاز.');
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats' })
  dashboard(@CurrentUser() user: CurrentUserPayload) {
    this.assertAdmin(user);
    return this.admin.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with search + phone filter' })
  listUsers(@CurrentUser() user: CurrentUserPayload, @Query() q: AdminListUsersQueryDto) {
    this.assertAdmin(user);
    return this.admin.listUsers(q);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail' })
  getUser(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.admin.getUser(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Change user role (cannot change own)' })
  changeRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Ip() ip?: string,
  ) {
    this.assertAdmin(user);
    return this.admin.changeUserRole(user.id, id, dto, ip);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Change user status (cannot change own)' })
  changeStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Ip() ip?: string,
  ) {
    this.assertAdmin(user);
    return this.admin.changeUserStatus(user.id, id, dto, ip);
  }

  @Get('users/:id/conversations')
  @ApiOperation({ summary: 'List user conversations (with audit log)' })
  userConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() q: AdminListConversationsQueryDto,
    @Ip() ip?: string,
  ) {
    this.assertAdmin(user);
    return this.admin.listUserConversations(user.id, id, q, ip);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation (with audit log)' })
  conversationMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() q: AdminListMessagesQueryDto,
    @Ip() ip?: string,
  ) {
    this.assertAdmin(user);
    return this.admin.listConversationMessages(user.id, id, q, ip);
  }

  @Get('messages/search')
  @ApiOperation({ summary: 'Search messages across all conversations' })
  searchMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: AdminSearchMessagesQueryDto,
    @Ip() ip?: string,
  ) {
    this.assertAdmin(user);
    return this.admin.searchMessages(user.id, q, ip);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List admin audit logs' })
  auditLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: AdminAuditLogsQueryDto,
  ) {
    this.assertAdmin(user);
    return this.admin.listAuditLogs(q);
  }

  @Get('settings/admin-phone')
  @ApiOperation({ summary: 'Get current admin phone setting' })
  getAdminPhone(@CurrentUser() user: CurrentUserPayload) {
    this.assertAdmin(user);
    return this.admin.getAdminPhone();
  }

  @Put('settings/admin-phone')
  @ApiOperation({ summary: 'Update admin phone setting' })
  updateAdminPhone(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateAdminPhoneDto,
    @Ip() ip?: string,
  ) {
    this.assertAdmin(user);
    return this.admin.updateAdminPhone(user.id, dto, ip);
  }
}
