import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { deleteFile, absoluteStoragePath } from '@/server/storage';
import { emitToConversation } from '@/server/websocket/emit';

/**
 * DELETE message - soft delete (deletedForEveryone=true).
 */
export const DELETE = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const message = await db.message.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!message) throw new Error('NOT_FOUND:پیام یافت نشد');

  const myPart = await db.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: message.conversationId,
        userId: user.id,
      },
    },
  });
  if (!myPart) throw new Error('FORBIDDEN');

  // Only sender or admin can delete for everyone
  if (message.senderId !== user.id && user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN');
  }

  await db.message.update({
    where: { id },
    data: { deletedForEveryone: true, body: null },
  });

  // Optionally delete attachment files from disk
  for (const att of message.attachments) {
    if (att.storagePath) {
      deleteFile(absoluteStoragePath(att.storagePath)).catch(() => {});
    }
  }
  await db.attachment.updateMany({
    where: { messageId: id },
    data: { messageId: null },
  });

  emitToConversation(message.conversationId, 'message:deleted', { messageId: id });

  return NextResponse.json({ ok: true });
});

/**
 * PATCH message - currently no editing, but could be extended.
 */
export const PATCH = withErrorHandler(async () => {
  return NextResponse.json({ error: 'ویرایش پیام پشتیبانی نمی‌شود' }, { status: 400 });
});
