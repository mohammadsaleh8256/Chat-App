import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler, parseOrThrow } from '@/lib/api-helpers';
import { completeUpload, relativeStoragePath, FILE_DIR } from '@/server/storage';
import { z } from 'zod';
import path from 'path';

const completeSchema = z.object({
  uploadId: z.string().min(1),
  totalChunks: z.number().int().positive(),
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(completeSchema, body);

  const mapping = await db.adminSetting.findUnique({
    where: { key: `upload_${input.uploadId}` },
  });
  if (!mapping) throw new Error('BAD_REQUEST:upload نامعتبر است');

  const attachment = await db.attachment.findUnique({
    where: { id: mapping.value },
  });
  if (!attachment || attachment.uploaderId !== user.id) {
    throw new Error('FORBIDDEN');
  }

  const ext = attachment.originalName.match(/\.[a-zA-Z0-9]+$/)?.[0] || '';
  const finalPath = path.join(FILE_DIR, `${input.uploadId}${ext}`);
  await completeUpload(input.uploadId, finalPath, input.totalChunks);

  await db.attachment.update({
    where: { id: attachment.id },
    data: {
      storagePath: relativeStoragePath(finalPath),
      uploadStatus: 'COMPLETED',
      receivedChunks: input.totalChunks,
      fileName: `${input.uploadId}${ext}`,
    },
  });

  // Remove mapping
  await db.adminSetting.delete({ where: { id: mapping.id } }).catch(() => {});

  return NextResponse.json({ ok: true, attachmentId: attachment.id });
});
