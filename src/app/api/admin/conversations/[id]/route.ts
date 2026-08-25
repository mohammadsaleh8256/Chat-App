import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { messageToPublic, conversationToSummary } from '@/lib/serializers';
import { recordAudit, getRequestIp } from '@/server/audit';

export const GET = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const admin = await requireAdmin();
  const { id } = await params;

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const conv = await db.conversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: true, attachments: true },
      },
    },
  });
  if (!conv) throw new Error('NOT_FOUND:گفتگو یافت نشد');

  const messages = await db.message.findMany({
    where: {
      conversationId: id,
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

  // Audit: admin viewed messages of this conversation
  await recordAudit({
    actorId: admin.id,
    action: 'VIEW_MESSAGE',
    targetType: 'CONVERSATION',
    targetId: id,
    targetUserId: conv.participants[0]?.userId,
    metadata: {
      conversationId: id,
      messageCount: messages.length,
      participantIds: conv.participants.map((p) => p.userId),
    },
    ipAddress: getRequestIp(req),
  });

  // For messageToPublic we need a "current user" perspective - use admin's id
  // (status will reflect admin's own receipts, which is fine for admin view)
  return NextResponse.json({
    conversation: conversationToSummary(conv, admin.id),
    messages: messages.map((m) => messageToPublic(m, admin.id)),
    nextCursor:
      messages.length === limit
        ? messages[messages.length - 1].createdAt.toISOString()
        : null,
  });
});
