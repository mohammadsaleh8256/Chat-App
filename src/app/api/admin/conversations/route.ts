import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { recordAudit, getRequestIp } from '@/server/audit';

export const GET = withErrorHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const participantUserId = url.searchParams.get('userId');

  const conversations = await db.conversation.findMany({
    where: participantUserId
      ? { participants: { some: { userId: participantUserId } } }
      : undefined,
    include: {
      participants: { include: { user: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: true, attachments: true },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
  });

  // Audit: admin viewed conversation list
  await recordAudit({
    actorId: admin.id,
    action: 'VIEW_CONVERSATION',
    targetType: 'CONVERSATION',
    targetUserId: participantUserId || undefined,
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title || c.participants.map((p) => `${p.user.firstName} ${p.user.lastName}`).join('، '),
      avatarUrl: c.avatarUrl,
      messageCount: c._count.messages,
      participants: c.participants.map((p) => ({
        userId: p.userId,
        name: `${p.user.firstName} ${p.user.lastName}`,
        phone: p.user.phone,
      })),
      lastMessageAt: c.lastMessageAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
  });
});
