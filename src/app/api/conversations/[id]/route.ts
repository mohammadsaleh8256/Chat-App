import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { conversationToSummary } from '@/lib/serializers';

export const GET = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const conv = await db.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: { user: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: true, attachments: true },
      },
    },
  });
  if (!conv) throw new Error('NOT_FOUND:گفتگو یافت نشد');

  const myPart = conv.participants.find((p) => p.userId === user.id);
  if (!myPart) throw new Error('FORBIDDEN');

  return NextResponse.json({ conversation: conversationToSummary(conv, user.id) });
});
