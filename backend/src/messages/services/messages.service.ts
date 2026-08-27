import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { ChatEvents } from '../../common/events/chat-events';
import { SendMessageDto, ListMessagesQueryDto, MessagesBeforeQueryDto, ForwardMessageDto } from '../dto/message.dto';

const ALLOWED_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE'];
const MAX_CONTENT_LENGTH = 8000;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger('MessagesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly chatEvents: ChatEvents,
  ) {}

  async sendText(senderId: string, conversationId: string, dto: SendMessageDto) {
    if (!await this.conversations.isMember(senderId, conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');
    if (dto.content.length > MAX_CONTENT_LENGTH)
      throw new BadRequestException(`طول پیام نباید بیشتر از ${MAX_CONTENT_LENGTH} کاراکتر باشد.`);

    const type = dto.type && ALLOWED_TYPES.includes(dto.type.toUpperCase())
      ? dto.type.toUpperCase()
      : 'TEXT';

    const now = new Date();
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: dto.content.trim(),
        type,
        status: 'SENT',
        replyToId: dto.replyToId ?? null,
        createdAt: now,
        updatedAt: now,
      },
      include: { sender: true, attachments: true, replyTo: true },
    });

    await this.conversations.updateLastMessage(conversationId, dto.content, now);

    // Notify all members (including the sender's other devices) that the conversation was updated
    this.chatEvents.emitConversationUpdated(conversationId, {
      messageId: msg.id,
      senderId,
      lastMessagePreview: dto.content,
    });

    return this.toDto(msg, senderId);
  }

  async sendWithAttachment(senderId: string, conversationId: string, dto: SendMessageDto) {
    if (!await this.conversations.isMember(senderId, conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');

    if (!dto.attachmentId) throw new BadRequestException('attachmentId الزامی است.');

    // dto.attachmentId could be either the attachment's UUID or the uploadId.
    // The frontend uploader returns attachment.id from /files/upload/complete,
    // so look up by id first, then fall back to uploadId.
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        OR: [
          { id: dto.attachmentId },
          { uploadId: dto.attachmentId },
        ],
      },
    });
    if (!attachment) throw new NotFoundException('فایل یافت نشد.');
    if (attachment.uploaderId !== senderId) throw new ForbiddenException('این فایل متعلق به شما نیست.');
    if (attachment.uploadStatus !== 'COMPLETED')
      throw new BadRequestException('فایل هنوز کامل آپلود نشده است.');

    const type = dto.type && ALLOWED_TYPES.includes(dto.type.toUpperCase())
      ? dto.type.toUpperCase()
      : 'FILE';

    const now = new Date();
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: (dto.content || '').trim(),
        type,
        status: 'SENT',
        replyToId: dto.replyToId ?? null,
        createdAt: now,
        updatedAt: now,
        attachments: { connect: { id: attachment.id } },
      },
      include: { sender: true, attachments: true, replyTo: true },
    });

    await this.conversations.updateLastMessage(conversationId, `📎 ${attachment.originalFileName}`, now);

    this.chatEvents.emitConversationUpdated(conversationId, {
      messageId: msg.id,
      senderId,
      lastMessagePreview: `📎 ${attachment.originalFileName}`,
    });

    return this.toDto(msg, senderId);
  }

  async listMessages(userId: string, conversationId: string, q: ListMessagesQueryDto) {
    if (!await this.conversations.isMember(userId, conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        include: { sender: true, attachments: true, replyTo: true },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.message.count({ where: { conversationId, deletedAt: null } }),
    ]);

    return {
      items: items.map((m) => this.toDto(m, userId)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async listMessagesBefore(userId: string, conversationId: string, q: MessagesBeforeQueryDto) {
    if (!await this.conversations.isMember(userId, conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');

    const before = new Date(q.before);
    const items = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null, createdAt: { lt: before } },
      include: { sender: true, attachments: true, replyTo: true },
      orderBy: { createdAt: 'desc' },
      take: q.pageSize,
    });

    return { items: items.map((m) => this.toDto(m, userId)) };
  }

  async markDelivered(userId: string, conversationId: string) {
    if (!await this.conversations.isMember(userId, conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');

    // Find all SENT messages from others (so we can emit events for each)
    const sentMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        status: 'SENT',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (sentMessages.length === 0) return;

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        status: 'SENT',
        deletedAt: null,
      },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });

    // Emit delivered event for each message so sender sees double-tick
    for (const m of sentMessages) {
      this.chatEvents.emitMessageDelivered(conversationId, m.id, userId);
    }
  }

  async markRead(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: true } } },
    });
    if (!msg || msg.deletedAt) throw new NotFoundException('پیام یافت نشد.');

    const isMember = await this.conversations.isMember(userId, msg.conversationId);
    if (!isMember) throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');

    if (msg.senderId !== userId) {
      // Add read receipt (idempotent)
      await this.prisma.messageRead.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt: new Date() },
        create: { messageId, userId, readAt: new Date() },
      });

      // Mark this message + all prior unread as READ
      await this.prisma.message.updateMany({
        where: {
          conversationId: msg.conversationId,
          senderId: { not: userId },
          status: { not: 'READ' },
          createdAt: { lte: msg.createdAt },
          deletedAt: null,
        },
        data: { status: 'READ', readAt: new Date() },
      });

      // Emit socket event so the SENDER's UI updates to blue double-tick
      this.chatEvents.emitMessageRead(msg.conversationId, messageId, userId);
    }
  }

  async delete(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.deletedAt) throw new NotFoundException('پیام یافت نشد.');
    if (msg.senderId !== userId)
      throw new ForbiddenException('فقط فرستنده می‌تواند پیام را حذف کند.');

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
  }

  async forward(userId: string, messageId: string, dto: ForwardMessageDto) {
    const orig = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });
    if (!orig || orig.deletedAt) throw new NotFoundException('پیام اصلی یافت نشد.');

    if (!await this.conversations.isMember(userId, dto.targetConversationId))
      throw new ForbiddenException('شما به گفتگوی مقصد دسترسی ندارید.');

    const type = orig.type;
    const now = new Date();
    const msg = await this.prisma.message.create({
      data: {
        conversationId: dto.targetConversationId,
        senderId: userId,
        content: orig.content,
        type: type as any,
        status: 'SENT',
        forwardedFromId: messageId,
        createdAt: now,
        updatedAt: now,
        attachments: orig.attachments.length
          ? { connect: orig.attachments.map((a) => ({ id: a.id })) }
          : undefined,
      },
      include: { sender: true, attachments: true, replyTo: true, forwardedFrom: true },
    });

    await this.conversations.updateLastMessage(
      dto.targetConversationId,
      orig.content || `📎 ${orig.attachments[0]?.originalFileName || 'فایل'}`,
      now,
    );

    this.chatEvents.emitConversationUpdated(dto.targetConversationId, {
      messageId: msg.id,
      senderId: userId,
      lastMessagePreview: orig.content || `📎 ${orig.attachments[0]?.originalFileName || 'فایل'}`,
    });

    return this.toDto(msg, userId);
  }

  async getMessage(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: true, attachments: true, replyTo: true },
    });
    if (!msg || msg.deletedAt) throw new NotFoundException('پیام یافت نشد.');
    if (!await this.conversations.isMember(userId, msg.conversationId))
      throw new ForbiddenException('شما به این گفتگو دسترسی ندارید.');
    return this.toDto(msg, userId);
  }

  private toDto(m: any, _currentUserId: string): any {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender?.fullName ?? '',
      senderAvatarUrl: m.sender?.avatarUrl ?? null,
      content: m.content,
      type: m.type,
      status: m.status,
      replyToId: m.replyToId,
      replyToPreview: m.replyTo?.content ?? null,
      forwardedFromId: m.forwardedFromId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      deletedAt: m.deletedAt,
      isEdited: m.isEdited,
      deliveredAt: m.deliveredAt,
      readAt: m.readAt,
      attachments: (m.attachments || []).map((a: any) => ({
        id: a.id,
        originalFileName: a.originalFileName,
        size: a.size.toString(),
        mimeType: a.mimeType,
        type: a.type,
        thumbnailUrl: a.thumbnailKey ? `/api/files/${a.id}/thumbnail` : null,
        downloadUrl: `/api/files/${a.id}`,
      })),
    };
  }
}
