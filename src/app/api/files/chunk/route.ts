import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/server/auth/session';
import { withErrorHandler, parseOrThrow } from '@/lib/api-helpers';
import { writeChunk, getReceivedChunks } from '@/server/storage';
import { z } from 'zod';

const chunkSchema = z.object({
  uploadId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  data: z.string().min(1), // base64
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const body = await req.json().catch(() => ({}));
  const input = parseOrThrow(chunkSchema, body);

  // Look up attachment by uploadId via AdminSetting mapping
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

  if (attachment.uploadStatus === 'COMPLETED') {
    return NextResponse.json({ ok: true, receivedChunks: attachment.receivedChunks });
  }

  // Decode base64 chunk
  const buffer = Buffer.from(input.data, 'base64');
  await writeChunk(input.uploadId, input.chunkIndex, buffer);

  const received = await getReceivedChunks(input.uploadId);
  await db.attachment.update({
    where: { id: attachment.id },
    data: { receivedChunks: received.length },
  });

  return NextResponse.json({ ok: true, receivedChunks: received.length });
});

/**
 * GET - returns received chunks for resumable uploads.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

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

  const received = await getReceivedChunks(uploadId);
  return NextResponse.json({
    receivedChunks: received,
    totalChunks: attachment.totalChunks,
    completed: attachment.uploadStatus === 'COMPLETED',
  });
});
