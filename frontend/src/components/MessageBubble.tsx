import type { Message } from '../types';
import { formatFileSize, formatTime, isImageType, isVideoType, isAudioType } from '../utils';
import { tokenStorage } from '../services/api';
import { Check, CheckCheck, AlertCircle, Clock, FileText, Download } from 'lucide-react';

interface Props {
  message: Message;
  isMine: boolean;
}

function StatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'SENDING') return <Clock size={12} className="opacity-60" />;
  if (status === 'SENT') return <Check size={14} />;
  if (status === 'DELIVERED') return <CheckCheck size={14} />;
  if (status === 'READ') return <CheckCheck size={14} className="text-sky-400" />;
  if (status === 'FAILED') return <AlertCircle size={14} className="text-red-500" />;
  return null;
}

/** Build a streaming URL that includes the access token as a query param.
 *  This is needed because <img>, <video>, <audio> tags can't set Authorization headers. */
function streamUrl(attachmentId: string): string {
  const token = tokenStorage.getAccess();
  return `/api/files/${attachmentId}/stream?token=${encodeURIComponent(token || '')}`;
}

/** For downloads, we need to use fetch + blob since <a> can't set headers either. */
async function downloadFile(attachmentId: string, fileName: string) {
  const token = tokenStorage.getAccess();
  if (!token) return;
  try {
    const resp = await fetch(`/api/files/${attachmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('Download failed');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download error:', err);
  }
}

export function MessageBubble({ message, isMine }: Props) {
  if (message.deletedAt) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-0.5`}>
        <div className={`max-w-[75%] px-3 py-2 rounded-lg text-xs text-gray-400 italic ${
          isMine ? 'bg-[#dcf8c6] dark:bg-[#005c4b] dark:text-gray-300' : 'bg-white dark:bg-[#202c33] dark:text-gray-400'
        }`}>
          این پیام حذف شده است.
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-0.5`}>
      <div className={`max-w-[75%] px-3 py-1.5 rounded-lg shadow-sm ${
        isMine ? 'bg-[#dcf8c6] dark:bg-[#005c4b] dark:text-white' : 'bg-white dark:bg-[#202c33] dark:text-gray-100'
      }`}>
        {/* Reply preview */}
        {message.replyToPreview && (
          <div className="mb-1 px-2 py-1 bg-black/5 dark:bg-white/10 rounded text-xs border-r-2 border-accent">
            <div className="text-gray-500 dark:text-gray-300">{message.replyToPreview.slice(0, 100)}</div>
          </div>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="mb-1 space-y-2">
            {message.attachments.map((a) => (
              <AttachmentView key={a.id} attachment={a} />
            ))}
          </div>
        )}

        {/* Content */}
        {message.content && (
          <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
        )}

        {/* Meta */}
        <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${isMine ? 'justify-end text-gray-500 dark:text-gray-300' : 'text-gray-400'}`}>
          <span>{formatTime(message.createdAt)}</span>
          {isMine && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function AttachmentView({ attachment }: { attachment: Message['attachments'][0] }) {
  const size = parseInt(attachment.size, 10);
  const mimeType = attachment.mimeType;
  const url = streamUrl(attachment.id);

  if (isImageType(mimeType)) {
    return (
      <div className="relative">
        <img
          src={url}
          alt={attachment.originalFileName}
          className="rounded-lg max-w-full max-h-80 cursor-pointer"
          loading="lazy"
          onClick={() => window.open(url, '_blank')}
        />
      </div>
    );
  }
  if (isVideoType(mimeType)) {
    return <video src={url} controls className="rounded-lg max-w-full max-h-80" />;
  }
  if (isAudioType(mimeType)) {
    return <audio src={url} controls className="w-full" />;
  }
  return (
    <button
      onClick={() => downloadFile(attachment.id, attachment.originalFileName)}
      className="flex items-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/10 rounded text-sm hover:bg-black/10 dark:hover:bg-white/15 w-full text-right"
    >
      <FileText size={24} className="text-gray-500 dark:text-gray-300" />
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs">{attachment.originalFileName}</div>
        <div className="text-[10px] opacity-60">{formatFileSize(size)}</div>
      </div>
      <Download size={16} />
    </button>
  );
}
