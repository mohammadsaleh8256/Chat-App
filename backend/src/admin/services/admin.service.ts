import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PhoneUtil } from '../../common/utils/phone.util';
import {
  AdminListUsersQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpdateAdminPhoneDto,
  AdminListConversationsQueryDto,
  AdminListMessagesQueryDto,
  AdminSearchMessagesQueryDto,
  AdminAuditLogsQueryDto,
} from '../dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger('AdminService');

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      onlineUsers,
      totalConversations,
      totalMessages,
      totalAttachments,
      totalAdmins,
      disabledUsers,
      activeUploads,
      attachmentSizes,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isOnline: true, deletedAt: null } }),
      this.prisma.conversation.count({ where: { deletedAt: null } }),
      this.prisma.message.count({ where: { deletedAt: null } }),
      this.prisma.attachment.count(),
      this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'DISABLED', deletedAt: null } }),
      this.prisma.attachment.count({ where: { uploadStatus: { in: ['UPLOADING', 'PENDING'] } } }),
      this.prisma.attachment.aggregate({ where: { uploadStatus: 'COMPLETED' }, _sum: { size: true } }),
    ]);

    return {
      totalUsers,
      onlineUsers,
      totalConversations,
      totalMessages,
      totalAttachments,
      totalAttachmentSizeBytes: (attachmentSizes._sum.size || BigInt(0)).toString(),
      totalAdmins,
      disabledUsers,
      activeUploads,
    };
  }

  async listUsers(q: AdminListUsersQueryDto) {
    const where: any = { deletedAt: null };
    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { firstName: { contains: s } },
        { lastName: { contains: s } },
        { fullName: { contains: s } },
      ];
    }
    if (q.phone) {
      const normalized = PhoneUtil.tryNormalize(q.phone);
      if (normalized) where.normalizedPhone = normalized;
      else where.phoneNumber = { contains: q.phone };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, firstName: true, lastName: true, fullName: true,
          phoneNumber: true, avatarUrl: true, role: true, status: true,
          isOnline: true, lastSeen: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true, fullName: true,
        phoneNumber: true, avatarUrl: true, bio: true, role: true, status: true,
        isOnline: true, lastSeen: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');
    return user;
  }

  async changeUserRole(adminId: string, targetUserId: string, dto: UpdateUserRoleDto, ip?: string) {
    if (!['USER', 'ADMIN'].includes(dto.role))
      throw new BadRequestException('نقش نامعتبر است.');
    if (adminId === targetUserId)
      throw new ForbiddenException('نمی‌توانید نقش خودتان را تغییر دهید.');

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const oldRole = user.role;
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
    });

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: 'CHANGE_ROLE',
        targetUserId,
        details: `Role changed from ${oldRole} to ${dto.role}`,
        ipAddress: ip,
      },
    });

    return this.toUserDto(updated);
  }

  async changeUserStatus(adminId: string, targetUserId: string, dto: UpdateUserStatusDto, ip?: string) {
    if (!['ACTIVE', 'DISABLED', 'DELETED'].includes(dto.status))
      throw new BadRequestException('وضعیت نامعتبر است.');
    if (adminId === targetUserId)
      throw new ForbiddenException('نمی‌توانید وضعیت خودتان را تغییر دهید.');

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد.');

    const oldStatus = user.status;
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: dto.status, deletedAt: dto.status === 'DELETED' ? new Date() : user.deletedAt },
    });

    const actionMap: Record<string, string> = {
      ACTIVE: 'ENABLE_USER',
      DISABLED: 'DISABLE_USER',
      DELETED: 'DELETE_USER',
    };

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: actionMap[dto.status] || 'UPDATE_SETTINGS',
        targetUserId,
        details: `Status changed from ${oldStatus} to ${dto.status}`,
        ipAddress: ip,
      },
    });

    return this.toUserDto(updated);
  }

  async listUserConversations(adminId: string, userId: string, q: AdminListConversationsQueryDto, ip?: string) {
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { deletedAt: null, participants: { some: { userId } } },
        include: {
          participants: { include: { user: { select: { id: true, fullName: true, phoneNumber: true, avatarUrl: true, isOnline: true, lastSeen: true } } } },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.conversation.count({ where: { deletedAt: null, participants: { some: { userId } } } }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: 'VIEW_USER',
        targetUserId: userId,
        details: 'Admin viewed user conversations',
        ipAddress: ip,
      },
    });

    return {
      items: items.map((c) => ({
        id: c.id,
        isGroup: c.isGroup,
        title: c.title,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview,
        createdAt: c.createdAt,
        otherParticipant: c.participants.find((p) => p.userId !== userId)?.user || null,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async listConversationMessages(adminId: string, conversationId: string, q: AdminListMessagesQueryDto, ip?: string) {
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.message.count({ where: { conversationId, deletedAt: null } }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: 'VIEW_CONVERSATION',
        targetConversationId: conversationId,
        details: `Admin viewed conversation messages (${items.length})`,
        ipAddress: ip,
      },
    });

    return {
      items: items.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.sender?.fullName || '',
        senderAvatarUrl: m.sender?.avatarUrl || null,
        content: m.content,
        type: m.type,
        status: m.status,
        createdAt: m.createdAt,
        deletedAt: m.deletedAt,
        attachments: m.attachments.map((a) => ({
          id: a.id,
          originalFileName: a.originalFileName,
          size: a.size.toString(),
          mimeType: a.mimeType,
          type: a.type,
          downloadUrl: `/api/files/${a.id}`,
        })),
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async searchMessages(adminId: string, q: AdminSearchMessagesQueryDto, ip?: string) {
    const s = q.q.trim();
    if (!s) return { items: [], total: 0 };

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { deletedAt: null, content: { contains: s } },
        include: { sender: { select: { id: true, fullName: true } }, conversation: true },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.message.count({ where: { deletedAt: null, content: { contains: s } } }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: 'VIEW_MESSAGE',
        details: `Admin searched messages for "${s}"`,
        ipAddress: ip,
      },
    });

    return {
      items: items.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.sender?.fullName || '',
        content: m.content,
        type: m.type,
        status: m.status,
        createdAt: m.createdAt,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async listAuditLogs(q: AdminAuditLogsQueryDto) {
    const where: any = {};
    if (q.from) where.createdAt = { gte: new Date(q.from) };
    if (q.to) where.createdAt = where.createdAt
      ? { ...where.createdAt, lte: new Date(q.to) }
      : { lte: new Date(q.to) };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { admin: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((l) => ({
        id: l.id,
        adminId: l.adminId,
        adminName: l.admin?.fullName || '',
        action: l.action,
        targetUserId: l.targetUserId,
        targetConversationId: l.targetConversationId,
        targetMessageId: l.targetMessageId,
        targetAttachmentId: l.targetAttachmentId,
        details: l.details,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async getAdminPhone() {
    const s = await this.prisma.appSetting.findUnique({ where: { key: 'INITIAL_ADMIN_PHONE' } });
    return { phoneNumber: s?.value || '' };
  }

  async updateAdminPhone(adminId: string, dto: UpdateAdminPhoneDto, ip?: string) {
    const phone = PhoneUtil.normalize(dto.phoneNumber);
    await this.prisma.appSetting.upsert({
      where: { key: 'INITIAL_ADMIN_PHONE' },
      update: { value: phone },
      create: {
        key: 'INITIAL_ADMIN_PHONE',
        value: phone,
        description: 'Phone number of the initial admin user.',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        adminId,
        action: 'CHANGE_ADMIN',
        details: `Admin phone changed to ${phone}`,
        ipAddress: ip,
      },
    });

    return { success: true, phoneNumber: phone };
  }

  private toUserDto(u: any) {
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: u.fullName,
      phoneNumber: u.phoneNumber,
      avatarUrl: u.avatarUrl,
      role: u.role,
      status: u.status,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }
}
