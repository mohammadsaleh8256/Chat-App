import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { messageToPublic } from '@/lib/serializers';

/**
 * Polling fallback endpoint: returns messages newer than `since` timestamp.
 * Used as a backup when WebSocket is not delivering events (e.g., peer offline,
 * WS service down, network issues).
 *
 * Usage: GET /api/conversations/[id]/messages/since?since=2024-01-01T00:00:00.000Z
 */
export const GET = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const url = new URL(req.url);
  const since = url.searchParams.get('since');
  if (!since) {
    return NextResponse.json({ error: 'since parameter required' }, { status: 400 });
  }

  // Verify the user is a participant of this conversation
  const myPart = await db.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId: id, userId: user.id },
    },
  });
  if (!myPart) throw new Error('FORBIDDEN');

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'invalid since date' }, { status: 400 });
  }

  const messages = await db.message.findMany({
    where: {
      conversationId: id,
      deletedForEveryone: false,
      createdAt: { gt: sinceDate },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      sender: true,
      attachments: true,
      replyTo: { include: { sender: true } },
      forwardedFrom: { include: { sender: true } },
      receipts: true,
    },
  });

  // Also return deleted message IDs so client can sync deletions
  const deletedMessages = await db.message.findMany({
    where: {
      conversationId: id,
      deletedForEveryone: true,
      updatedAt: { gt: sinceDate },
    },
    select: { id: true },
  });

  const serverTime = new Date().toISOString();

  return NextResponse.json({
    messages: messages.map((m) => messageToPublic(m, user.id)),
    deletedMessageIds: deletedMessages.map((m) => m.id),
    serverTime,
  });
});
