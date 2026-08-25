'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Send, Smile, X, Loader2, FileText, Trash2 } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { emitTypingEvent } from '@/hooks/use-socket';
import { toast } from 'sonner';
import { formatBytes, toPersianDigits, api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

interface MessageInputProps {
  conversationId: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
}

interface PendingAttachment {
  uploadId: string;
  attachmentId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  preview?: string;
}

export function MessageInput({ conversationId, replyTo, onCancelReply }: MessageInputProps) {
  const [text, setText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);

  const emitTyping = useCallback((convId: string, typing: boolean) => {
    emitTypingEvent(convId, typing);
  }, []);

  // Cleanup typing indicator when unmounting
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (isTyping) emitTyping(conversationId, false);
    };
  }, []);

  const onTextChange = (v: string) => {
    setText(v);
    if (!isTyping) {
      setIsTyping(true);
      emitTyping(conversationId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      emitTyping(conversationId, false);
    }, 1500);
  };

  const onFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      uploadFile(file).catch((err) => {
        console.error('Upload error:', err);
        toast.error(`آپلود ناموفق: ${file.name}`);
      });
    }
  }, []);

  const uploadFile = async (file: File) => {
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // 1. Init
      const initRes = await api<{ attachmentId: string; uploadId: string }>(
        '/api/files/init',
        {
          method: 'POST',
          json: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            totalChunks,
            chunkSize: CHUNK_SIZE,
          },
        }
      );

      const pending: PendingAttachment = {
        uploadId: initRes.uploadId,
        attachmentId: initRes.attachmentId,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        progress: 0,
        status: 'uploading',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };
      setPendingAttachments((p) => [...p, pending]);

      // 2. Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const buffer = await chunk.arrayBuffer();
        const base64 = bufferToBase64(buffer);

        await api('/api/files/chunk', {
          method: 'POST',
          json: {
            uploadId: initRes.uploadId,
            chunkIndex: i,
            data: base64,
          },
        });

        setPendingAttachments((prev) =>
          prev.map((p) =>
            p.uploadId === initRes.uploadId
              ? { ...p, progress: Math.round(((i + 1) / totalChunks) * 100) }
              : p
          )
        );
      }

      // 3. Complete
      await api('/api/files/complete', {
        method: 'POST',
        json: {
          uploadId: initRes.uploadId,
          totalChunks,
        },
      });

      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.uploadId === initRes.uploadId ? { ...p, status: 'done', progress: 100 } : p
        )
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'خطای ناشناخته';
      toast.error(`آپلود ناموفق: ${msg}`);
      setPendingAttachments((prev) =>
        prev.map((p) => (p.fileName === file.name ? { ...p, status: 'error' } : p))
      );
    }
  };

  const cancelUpload = async (uploadId: string, attachmentId: string) => {
    try {
      await api(`/api/files/${attachmentId}?uploadId=${uploadId}`, { method: 'DELETE' });
      setPendingAttachments((prev) => prev.filter((p) => p.uploadId !== uploadId));
    } catch {
      toast.error('لغو آپلود ناموفق');
    }
  };

  const onSend = async () => {
    if (!text.trim() && pendingAttachments.length === 0) return;
    if (pendingAttachments.some((p) => p.status === 'uploading')) {
      toast.warning('لطفاً منتظر تکمیل آپلود فایل‌ها بمانید');
      return;
    }
    setSending(true);
    try {
      const attachmentIds = pendingAttachments.map((p) => p.attachmentId);
      await sendMessage(conversationId, text.trim(), {
        replyToId: replyTo?.id,
        attachmentIds,
      });
      setText('');
      setPendingAttachments([]);
      onCancelReply();
      if (isTyping) {
        setIsTyping(false);
        emitTyping(conversationId, false);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'خطا در ارسال';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onFileSelect(e.dataTransfer.files);
  };

  // Paste image
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const f = items[i].getAsFile();
        if (f) files.push(f);
      }
      if (files.length > 0) {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        onFileSelect(dt.files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [onFileSelect]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        'border-t border-border bg-card p-2 transition-colors',
        isDragging && 'bg-primary/5 ring-2 ring-primary'
      )}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none z-10">
          <p className="text-primary font-medium">فایل را اینجا رها کنید</p>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 p-2 rounded-md bg-muted border-r-2 border-primary flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">
              {replyTo.isOwn ? 'شما' : replyTo.senderName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.body || '📎 فایل'}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancelReply}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((p) => (
            <div
              key={p.uploadId}
              className="relative flex items-center gap-2 p-2 rounded-lg bg-muted text-xs max-w-[200px]"
            >
              {p.preview ? (
                <img src={p.preview} alt={p.fileName} className="w-10 h-10 object-cover rounded" />
              ) : (
                <div className="w-10 h-10 rounded bg-primary/15 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{p.fileName}</p>
                <p className="text-muted-foreground">
                  {formatBytes(p.sizeBytes)}
                  {p.status === 'uploading' && ` • ${toPersianDigits(p.progress)}%`}
                </p>
                {p.status === 'uploading' && (
                  <div className="h-1 bg-muted-foreground/20 rounded mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {p.status === 'uploading' && (
                <button
                  onClick={() => cancelUpload(p.uploadId, p.attachmentId)}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              {p.status === 'done' && (
                <span className="text-emerald-500 text-xs">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFileSelect(e.target.files)}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          title="ضمیمه فایل"
          className="shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <Input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="پیام بنویسید..."
          className="flex-1"
          disabled={sending}
        />
        <Button
          onClick={onSend}
          disabled={sending || (!text.trim() && pendingAttachments.length === 0)}
          size="icon"
          className="shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}
