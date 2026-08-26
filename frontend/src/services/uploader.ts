import api from './api';
import type { UploadInit } from '../types';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export interface UploadProgress {
  totalBytes: number;
  uploadedBytes: number;
  totalChunks: number;
  receivedChunks: number;
  percent: number;
  completed: boolean;
}

export interface UploadController {
  cancel: () => void;
  promise: Promise<string>; // resolves to attachmentId
}

export async function uploadFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  const chunkSize = DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  // Init upload session
  const { data: init } = await api.post<UploadInit>('/files/upload/init', {
    fileName: file.name,
    fileSize: file.size,
    totalChunks,
    mimeType: file.type || 'application/octet-stream',
  });

  // Resume: skip chunks already received
  let startChunk = init.canResume ? init.receivedChunks : 0;

  for (let i = startChunk; i < totalChunks; i++) {
    if (signal?.aborted) {
      await api.post(`/files/upload/${init.uploadId}/cancel`).catch(() => {});
      throw new DOMException('Upload aborted', 'AbortError');
    }

    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);

    // Retry with exponential backoff
    let attempt = 0;
    let success = false;
    while (!success && attempt < 5) {
      try {
        await api.post(`/files/upload/${init.uploadId}/chunk/${i}`, blob, {
          headers: { 'Content-Type': 'application/octet-stream' },
          timeout: 60_000,
        });
        success = true;
      } catch (err) {
        attempt++;
        if (attempt >= 5) throw err;
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    }

    const uploadedBytes = (i + 1) * chunkSize;
    onProgress({
      totalBytes: file.size,
      uploadedBytes: Math.min(uploadedBytes, file.size),
      totalChunks,
      receivedChunks: i + 1,
      percent: Math.floor(((i + 1) / totalChunks) * 100),
      completed: false,
    });
  }

  // Complete
  const { data: complete } = await api.post(`/files/upload/${init.uploadId}/complete`, {
    fileHash: null,
  });

  onProgress({
    totalBytes: file.size,
    uploadedBytes: file.size,
    totalChunks,
    receivedChunks: totalChunks,
    percent: 100,
    completed: true,
  });

  return complete.attachmentId as string;
}
