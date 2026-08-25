import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { messageToPublic } from '@/lib/serializers';
import { sendMessageSchema } from '@/server/auth/validation';
import { parseOrThrow } from '@/lib/api-helpers';
import { emitToConversation } from '@/server/websocket/emit';

export const GET = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);

  const myPart = await db.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: id, userId: user.id },
    },
  });
  if (!myPart) throw new Error('FORBIDDEN');

  const messages = await db.message.findMany({
    where: {
      conversationId: id,
      deletedForEveryone: false,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true } },
      forwardedFrom: { include: { sender: true } },
      receipts: true,
    },
  });

  // Mark messages as read (update lastReadAt)
  await db.conversationParticipant.update({
    where: { id: myPart.id },
    data: { lastReadAt: new Date() },
  });

  // Mark delivered + read receipts for incoming messages
  const otherMessages = messages.filter((m) => m.senderId !== user.id);
  if (otherMessages.length > 0) {
    for (const m of otherMessages) {
      await db.messageReceipt.upsert({
        where: {
          messageId_userId: { messageId: m.id, userId: user.id },
        },
        create: { messageId: m.id, userId: user.id, status: 'READ' },
        update: { status: 'READ' },
      });
      emitToConversation(id, 'message:read', {
        messageId: m.id,
        conversationId: id,
        userId: user.id,
        status: 'READ',
      });
    }
  }

  return NextResponse.json({
    messages: messages.map((m) => messageToPublic(m, user.id)),
    nextCursor:
      messages.length === limit
        ? messages[messages.length - 1].createdAt.toISOString()
        : null,
  });
});

export const POST = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(sendMessageSchema, body);

  if (!body.body && (!input.attachments || input.attachments.length === 0)) {
    throw new Error('BAD_REQUEST:متن یا فایل پیام الزامی است');
  }

  const myPart = await db.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: id, userId: user.id },
    },
  });
  if (!myPart) throw new Error('FORBIDDEN');

  // Determine message type based on attachments
  let type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' = 'TEXT';
  if (input.attachments && input.attachments.length > 0) {
    const att = await db.attachment.findUnique({ where: { id: input.attachments[0] } });
    if (att) {
      const mime = att.mimeType;
      if (mime.startsWith('image/')) type = 'IMAGE';
      else if (mime.startsWith('video/')) type = 'VIDEO';
      else if (mime.startsWith('audio/')) type = 'AUDIO';
      else type = 'FILE';
    }
  }

  // Validate attachments belong to current user
  if (input.attachments && input.attachments.length > 0) {
    const owned = await db.attachment.findMany({
      where: { id: { in: input.attachments }, uploaderId: user.id },
    });
    if (owned.length !== input.attachments.length) {
      throw new Error('BAD_REQUEST:فایل‌های نامعتبر');
    }
  }

  const message = await db.message.create({
    data: {
      conversationId: id,
      senderId: user.id,
      body: body.body || null,
      type,
      replyToId: input.replyToId || null,
      forwardedFromId: input.forwardedFromId || null,
      attachments: input.attachments && input.attachments.length > 0
        ? { connect: input.attachments.map((aid: string) => ({ id: aid })) }
        : undefined,
    },
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true } },
      forwardedFrom: { include: { sender: true } },
      receipts: true,
    },
  });

  // Update conversation timestamp
  await db.conversation.update({
    where: { id },
    data: { lastMessageAt: new Date(), updatedAt: new Date() },
  });

  // Emit to other participants
  const publicMessage = messageToPublic(message, user.id);
  emitToConversation(id, 'message:new', { message: publicMessage });

  // Also emit conversation update
  emitToConversation(id, 'conversation:update', { conversationId: id });

  return NextResponse.json({ message: publicMessage });
});
