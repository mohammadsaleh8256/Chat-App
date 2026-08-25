'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatTime, getInitials, avatarColor, formatBytes } from '@/lib/api';
import { Download, FileText, Reply, Trash2, Copy, Forward, Check, CheckCheck, Play } from 'lucide-react';
import { useState, useRef } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from 'sonner';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: ChatMessage;
  isGroup: boolean;
  showSender: boolean;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
}

export function MessageBubble({
  message,
  isGroup,
  showSender,
  onReply,
  onForward,
  onDelete,
}: MessageBubbleProps) {
  const isOwn = message.isOwn;
  const [imageOpen, setImageOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleCopy = () => {
    if (message.body) {
      navigator.clipboard.writeText(message.body);
      toast.success('پیام کپی شد');
    }
  };

  if (message.deletedForEveryone) {
    return (
      <div className={cn('flex justify-end my-1', !isOwn && 'justify-start')}>
        <div className="max-w-[75%] px-3 py-2 rounded-2xl bg-muted text-muted-foreground italic text-sm">
          پیام حذف شد 🗑️
        </div>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn('flex gap-2 my-1 group', isOwn ? 'justify-end' : 'justify-start')}>
          {!isOwn && showSender && (
            <Avatar className="w-8 h-8 shrink-0 self-end">
              {message.senderAvatarUrl && (
                <AvatarImage src={message.senderAvatarUrl} alt={message.senderName} />
              )}
              <AvatarFallback className={cn('text-xs', avatarColor(message.senderId))}>
                {getInitials(message.senderName)}
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              'max-w-[75%] rounded-2xl px-3 py-2 shadow-sm break-words',
              isOwn
                ? 'bg-[var(--bubble-out)] text-foreground rounded-bl-md'
                : 'bg-[var(--bubble-in)] text-foreground rounded-br-md',
              !isOwn && !showSender && 'mr-10'
            )}
          >
            {/* Sender name (groups only, non-own) */}
            {!isOwn && isGroup && showSender && (
              <p className="text-xs font-semibold text-primary mb-0.5">{message.senderName}</p>
            )}

            {/* Forwarded indicator */}
            {message.forwardedFrom && (
              <p className="text-[10px] text-muted-foreground italic mb-1 flex items-center gap-1">
                <Forward className="w-3 h-3" />
                فوروارد شده از {message.forwardedFrom.senderName}
              </p>
            )}

            {/* Reply preview */}
            {message.replyTo && (
              <div className="border-r-2 border-primary pr-2 mb-1.5 text-xs bg-black/5 rounded p-1.5">
                <p className="font-semibold text-primary">{message.replyTo.senderName}</p>
                <p className="text-muted-foreground truncate">{message.replyTo.body || '📎 فایل'}</p>
              </div>
            )}

            {/* Attachments */}
            {message.attachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                onImageClick={() => setImageOpen(true)}
                videoRef={videoRef}
              />
            ))}

            {/* Body */}
            {message.body && (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
            )}

            {/* Time + status */}
            <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(message.createdAt)}
              </span>
              {isOwn && (
                <>
                  {message.status === 'READ' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                  ) : message.status === 'DELIVERED' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onReply}>
          <Reply className="w-4 h-4 ml-2" /> پاسخ
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy} disabled={!message.body}>
          <Copy className="w-4 h-4 ml-2" /> کپی
        </ContextMenuItem>
        <ContextMenuItem onClick={onForward}>
          <Forward className="w-4 h-4 ml-2" /> فوروارد
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 ml-2" /> حذف
        </ContextMenuItem>
      </ContextMenuContent>

      {imageOpen && message.attachments[0] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImageOpen(false)}
        >
          <img
            src={message.attachments[0].downloadUrl}
            alt={message.attachments[0].fileName}
            className="max-w-full max-h-full object-contain"
          />
          <Button
            className="absolute top-4 right-4"
            variant="secondary"
            onClick={() => setImageOpen(false)}
          >
            بستن
          </Button>
        </div>
      )}
    </ContextMenu>
  );
}

function AttachmentPreview({
  attachment,
  onImageClick,
  videoRef,
}: {
  attachment: ChatMessage['attachments'][0];
  onImageClick: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  if (attachment.type === 'IMAGE') {
    return (
      <button onClick={onImageClick} className="block mb-1">
        <img
          src={attachment.downloadUrl}
          alt={attachment.fileName}
          className="max-w-full max-h-72 rounded-lg object-cover"
        />
      </button>
    );
  }
  if (attachment.type === 'VIDEO') {
    return (
      <div className="mb-1 rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={attachment.downloadUrl}
          className="max-w-full max-h-72"
          controls
        />
      </div>
    );
  }
  if (attachment.type === 'AUDIO') {
    return (
      <div className="mb-1 rounded-lg bg-black/5 p-2">
        <audio src={attachment.downloadUrl} controls className="w-full" />
      </div>
    );
  }
  // File
  return (
    <a
      href={attachment.downloadUrl}
      download={attachment.fileName}
      className="flex items-center gap-2 mb-1 p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(attachment.sizeBytes)}</p>
      </div>
      <Download className="w-4 h-4 text-muted-foreground" />
    </a>
  );
}
