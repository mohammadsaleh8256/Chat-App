import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { conversationToSummary } from '@/lib/serializers';

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const participations = await db.conversationParticipant.findMany({
    where: { userId: user.id },
    select: { conversationId: true },
  });
  const ids = participations.map((p) => p.conversationId);
  if (ids.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const conversations = await db.conversation.findMany({
    where: { id: { in: ids } },
    include: {
      participants: {
        include: { user: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: true,
          attachments: true,
        },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => conversationToSummary(c, user.id)),
  });
});

/**
 * Create a new conversation. For DIRECT type, reuse an existing one if exists.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const body = await req.json().catch(() => ({}));
  const { participantId, type = 'DIRECT', title } = body as {
    participantId?: string;
    type?: 'DIRECT' | 'GROUP';
    title?: string;
  };

  if (!participantId) throw new Error('BAD_REQUEST:شناسه کاربر الزامی است');

  const other = await db.user.findUnique({ where: { id: participantId } });
  if (!other) throw new Error('NOT_FOUND:کاربر یافت نشد');

  // For DIRECT, find existing conversation between these two users
  if (type === 'DIRECT') {
    const existing = await db.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: true, attachments: true } },
      },
    });
    if (existing) {
      return NextResponse.json({ conversation: conversationToSummary(existing, user.id) });
    }
  }

  const conv = await db.conversation.create({
    data: {
      type,
      title,
      participants: {
        create: [
          { userId: user.id },
          { userId: participantId },
        ],
      },
    },
    include: {
      participants: { include: { user: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: true, attachments: true } },
    },
  });

  return NextResponse.json({ conversation: conversationToSummary(conv, user.id) });
});
