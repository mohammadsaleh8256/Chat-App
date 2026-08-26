import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConversationDto, ListConversationsQueryDto } from '../dto/conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGet(currentUserId: string, otherUserId: string) {
    if (currentUserId === otherUserId)
      throw new BadRequestException('امکان ایجاد گفتگو با خود وجود ندارد.');

    const other = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other || other.deletedAt) throw new NotFoundException('کاربر مقابل یافت نشد.');

    // Find existing private conversation between these two users
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { isGroup: false },
          { deletedAt: null },
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: { participants: { include: { user: true } } },
    });

    if (existing) {
      return this.toDto(existing, currentUserId);
    }

    const conv = await this.prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId: currentUserId, joinedAt: new Date() },
            { userId: otherUserId, joinedAt: new Date() },
          ],
        },
      },
      include: { participants: { include: { user: true } } },
    });

    return this.toDto(conv, currentUserId);
  }

  async listConversations(currentUserId: string, q: ListConversationsQueryDto) {
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          deletedAt: null,
          participants: { some: { userId: currentUserId, leftAt: null } },
        },
        include: { participants: { include: { user: true } } },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.conversation.count({
        where: {
          deletedAt: null,
          participants: { some: { userId: currentUserId, leftAt: null } },
        },
      }),
    ]);

    const enriched = await Promise.all(items.map(async (c) => {
      const dto = this.toDto(c, currentUserId);
      dto.unreadCount = await this.getUnreadCount(currentUserId, c.id);
      return dto;
    }));

    return { items: enriched, total, page: q.page, pageSize: q.pageSize };
  }

  async getConversation(currentUserId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { include: { user: true } } },
    });
    if (!conv || conv.deletedAt) throw new NotFoundException('گفتگو یافت نشد.');

    if (!await this.isMember(currentUserId, conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');

    const dto = this.toDto(conv, currentUserId);
    dto.unreadCount = await this.getUnreadCount(currentUserId, conversationId);
    return dto;
  }

  async isMember(userId: string, conversationId: string): Promise<boolean> {
    const p = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    return !!p;
  }

  async markConversationRead(userId: string, conversationId: string) {
    if (!await this.isMember(userId, conversationId))
      throw new ForbiddenException('دسترسی غیرمجاز.');
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  async getUnreadCount(userId: string, conversationId: string): Promise<number> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        deletedAt: null,
        ...(participant?.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {}),
      },
    });
  }

  async updateLastMessage(conversationId: string, content: string, time: Date) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: time,
        lastMessagePreview: content.slice(0, 200),
        updatedAt: time,
      },
    });
  }

  private toDto(conv: any, currentUserId: string): any {
    const other = conv.participants.find((p: any) => p.userId !== currentUserId)?.user;
    return {
      id: conv.id,
      isGroup: conv.isGroup,
      title: conv.title,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: conv.lastMessagePreview,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      unreadCount: 0,
      otherParticipant: other ? {
        id: other.id,
        fullName: other.fullName,
        phoneNumber: other.phoneNumber,
        avatarUrl: other.avatarUrl,
        isOnline: other.isOnline,
        lastSeen: other.lastSeen,
      } : null,
    };
  }
}
