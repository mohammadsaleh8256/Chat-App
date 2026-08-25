import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler, parseOrThrow } from '@/lib/api-helpers';
import { initUpload } from '@/server/storage';
import { z } from 'zod';

const initSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024 * 1024), // 5GB cap
  mimeType: z.string().min(1).max(100),
  totalChunks: z.number().int().positive().max(100000),
  chunkSize: z.number().int().positive(),
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(initSchema, body);

  const { uploadId, finalPath } = await initUpload(input.fileName);

  const attachment = await db.attachment.create({
    data: {
      uploaderId: user.id,
      fileName: uploadId,
      originalName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.fileSize,
      storagePath: '', // will be set on complete
      uploadStatus: 'UPLOADING',
      totalChunks: input.totalChunks,
      receivedChunks: 0,
    },
  });

  // Save uploadId <-> attachmentId mapping in a setting-like record
  await db.adminSetting.create({
    data: {
      key: `upload_${uploadId}`,
      value: attachment.id,
    },
  });

  return NextResponse.json({
    attachmentId: attachment.id,
    uploadId,
    chunkSize: input.chunkSize,
  });
});
