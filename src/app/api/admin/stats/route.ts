import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async () => {
  await requireAdmin();

  const [
    totalUsers,
    totalConversations,
    totalMessages,
    totalAttachments,
    totalSize,
    adminCount,
  ] = await Promise.all([
    db.user.count(),
    db.conversation.count(),
    db.message.count({ where: { deletedForEveryone: false } }),
    db.attachment.count({ where: { uploadStatus: 'COMPLETED' } }),
    db.attachment.aggregate({ _sum: { sizeBytes: true } }),
    db.user.count({ where: { role: 'ADMIN' } }),
  ]);

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newUsers24h = await db.user.count({ where: { createdAt: { gt: last24h } } });
  const newMessages24h = await db.message.count({ where: { createdAt: { gt: last24h } } });

  return NextResponse.json({
    stats: {
      totalUsers,
      totalConversations,
      totalMessages,
      totalAttachments,
      totalStorageBytes: totalSize._sum.sizeBytes || 0,
      adminCount,
      newUsers24h,
      newMessages24h,
    },
  });
});
