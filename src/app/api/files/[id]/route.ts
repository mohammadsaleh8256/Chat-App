import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler } from '@/lib/api-helpers';
import { getFileStream, absoluteStoragePath, abortUpload } from '@/server/storage';
import { recordAudit, getRequestIp } from '@/server/audit';
import path from 'path';

/**
 * GET - download file. Requires admin or attachment uploader (or message recipient).
 */
export const GET = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const url = new URL(req.url);
  const thumb = url.searchParams.get('thumb') === '1';

  const attachment = await db.attachment.findUnique({
    where: { id },
    include: { message: true },
  });
  if (!attachment) throw new Error('NOT_FOUND:فایل یافت نشد');

  // Authorization: uploader, recipient of message, or admin
  let authorized = attachment.uploaderId === user.id || user.role === 'ADMIN';
  if (!authorized && attachment.message) {
    const myPart = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: attachment.message.conversationId,
          userId: user.id,
        },
      },
    });
    authorized = !!myPart;
  }
  if (!authorized) throw new Error('FORBIDDEN');

  const filePath = thumb
    ? (attachment.thumbnailPath
        ? absoluteStoragePath(attachment.thumbnailPath)
        : absoluteStoragePath(attachment.storagePath))
    : absoluteStoragePath(attachment.storagePath);

  // If admin, audit the view
  if (user.role === 'ADMIN' && !thumb) {
    await recordAudit({
      actorId: user.id,
      action: 'VIEW_ATTACHMENT',
      targetType: 'ATTACHMENT',
      targetId: attachment.id,
      targetUserId: attachment.uploaderId,
      metadata: { fileName: attachment.originalName, sizeBytes: attachment.sizeBytes },
      ipAddress: getRequestIp(req),
    });
  }

  const stream = getFileStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
      'Content-Length': String(attachment.sizeBytes),
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

/**
 * DELETE - abort an in-progress upload.
 */
export const DELETE = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const { id } = await params;

  const url = new URL(req.url);
  const uploadId = url.searchParams.get('uploadId');
  if (!uploadId) throw new Error('BAD_REQUEST:uploadId الزامی است');

  const mapping = await db.adminSetting.findUnique({
    where: { key: `upload_${uploadId}` },
  });
  if (!mapping) throw new Error('NOT_FOUND:upload یافت نشد');

  const attachment = await db.attachment.findUnique({
    where: { id: mapping.value },
  });
  if (!attachment || attachment.uploaderId !== user.id) {
    throw new Error('FORBIDDEN');
  }

  await abortUpload(uploadId);
  await db.attachment.update({
    where: { id: attachment.id },
    data: { uploadStatus: 'ABORTED' },
  });
  await db.adminSetting.delete({ where: { id: mapping.id } }).catch(() => {});

  return NextResponse.json({ ok: true });
});
