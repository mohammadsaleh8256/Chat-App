import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';
import { chatSocket } from '../services/socket';
import { uploadFile, type UploadProgress } from '../services/uploader';
import toast from 'react-hot-toast';
import type { Conversation, Message, User } from '../types';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { formatPhone, relativeTime } from '../utils';
import { ArrowRight, Paperclip, Send, X } from 'lucide-react';

interface Props {
  conversation: Conversation;
  currentUser: User;
  onBack: () => void;
}

const PAGE_SIZE = 50;

export function ChatWindow({ conversation, currentUser, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestAt, setOldestAt] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [uploadState, setUploadState] = useState<{ name: string; percent: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const stopTypingTimerRef = useRef<any>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ items: Message[] }>(`/conversations/${conversation.id}/messages`, {
        params: { page: 1, pageSize: PAGE_SIZE },
      });
      setMessages(data.items);
      if (data.items.length > 0) {
        const oldest = data.items.reduce((min, m) => m.createdAt < min ? m.createdAt : min, data.items[0].createdAt);
        setOldestAt(oldest);
        setHasMore(data.items.length >= PAGE_SIZE);
      }
      setTimeout(() => scrollToBottom(), 100);
      // Mark as delivered
      api.post(`/conversations/${conversation.id}/delivered`).catch(() => {});
    } catch {} finally { setLoading(false); }
  }, [conversation.id]);

  useEffect(() => {
    loadMessages();
    setOtherTyping(false);

    const offReceive = chatSocket.on('message:receive', (data: any) => {
      if (data.conversationId !== conversation.id) return;
      // Fetch latest message
      api.get<{ items: Message[] }>(`/conversations/${conversation.id}/messages`, { params: { pageSize: 1 } })
        .then(({ data }) => {
          if (data.items.length > 0) {
            const newMsg = data.items[0];
            setMessages((prev) => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            chatSocket.emit('message:delivered', { conversationId: conversation.id, messageId: newMsg.id });
            setTimeout(() => scrollToBottom(), 100);
          }
        })
        .catch(() => {});
    });

    const offTyping = chatSocket.on('typing:start', (data: any) => {
      if (data.conversationId === conversation.id && data.userId !== currentUser.id) {
        setOtherTyping(true);
        if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
      }
    });

    const offStop = chatSocket.on('typing:stop', (data: any) => {
      if (data.conversationId === conversation.id) setOtherTyping(false);
    });

    const offDelivered = chatSocket.on('message:delivered', (data: any) => {
      if (data.conversationId !== conversation.id) return;
      setMessages((prev) => prev.map(m => m.id === data.messageId && m.senderId === currentUser.id
        ? { ...m, status: 'DELIVERED', deliveredAt: new Date().toISOString() }
        : m));
    });

    const offRead = chatSocket.on('message:read', (data: any) => {
      if (data.conversationId !== conversation.id) return;
      setMessages((prev) => prev.map(m => m.id === data.messageId && m.senderId === currentUser.id
        ? { ...m, status: 'READ', readAt: new Date().toISOString(), deliveredAt: m.deliveredAt || new Date().toISOString() }
        : m));
    });

    return () => { offReceive(); offTyping(); offStop(); offDelivered(); offRead(); };
  }, [conversation.id, currentUser.id, loadMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMore = async () => {
    if (!oldestAt || loadingMore) return;
    setLoadingMore(true);
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const { data } = await api.get<{ items: Message[] }>(`/conversations/${conversation.id}/messages/before`, {
        params: { before: oldestAt, pageSize: PAGE_SIZE },
      });
      if (data.items.length > 0) {
        setMessages((prev) => [...data.items, ...prev]);
        const newOldest = data.items.reduce((min, m) => m.createdAt < min ? m.createdAt : min, data.items[0].createdAt);
        setOldestAt(newOldest);
        setHasMore(data.items.length >= PAGE_SIZE);
        // Preserve scroll position
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        }, 50);
      } else setHasMore(false);
    } catch {} finally { setLoadingMore(false); }
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (text.trim()) {
      chatSocket.emit('typing:start', { conversationId: conversation.id });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        chatSocket.emit('typing:stop', { conversationId: conversation.id });
      }, 1500);
    }
  };

  const send = async () => {
    if (sending || !text.trim()) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const { data: msg } = await api.post<Message>(`/conversations/${conversation.id}/messages`, {
        content, type: 'TEXT',
      });
      setMessages((prev) => [...prev, msg]);
      chatSocket.emit('message:send', { conversationId: conversation.id, messageId: msg.id });
      setTimeout(() => scrollToBottom(), 50);
    } catch {
      setText(content);  // Restore on failure
      toast.error('ارسال پیام ناموفق بود.');
    } finally {
      setSending(false);
    }
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';  // reset for re-pick

    const controller = new AbortController();
    abortRef.current = controller;
    setUploadState({ name: file.name, percent: 0 });

    try {
      const attachmentId = await uploadFile(
        file,
        (p: UploadProgress) => setUploadState({ name: file.name, percent: p.percent }),
        controller.signal,
      );
      const { data: msg } = await api.post<Message>(`/conversations/${conversation.id}/messages`, {
        content: '', type: file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('audio/') ? 'AUDIO' : 'FILE',
        attachmentId,
      });
      setMessages((prev) => [...prev, msg]);
      chatSocket.emit('message:send', { conversationId: conversation.id, messageId: msg.id });
      setTimeout(() => scrollToBottom(), 50);
      toast.success(`فایل «${file.name}» ارسال شد.`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(`خطا در آپلود: ${err.message || 'نامشخص'}`);
      }
    } finally {
      setUploadState(null);
      abortRef.current = null;
    }
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setUploadState(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 px-4 py-2 flex items-center gap-3 border-b dark:border-gray-700">
        <button onClick={onBack} className="md:hidden p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
          <ArrowRight size={20} />
        </button>
        <Avatar
          name={conversation.otherParticipant?.fullName}
          url={conversation.otherParticipant?.avatarUrl}
          size={40}
          isOnline={conversation.otherParticipant?.isOnline}
          showStatus
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
            {conversation.otherParticipant?.fullName || 'بدون نام'}
          </div>
          <div className="text-xs text-gray-500">
            {otherTyping ? (
              <span className="text-accent">در حال نوشتن...</span>
            ) : conversation.otherParticipant?.isOnline ? (
              <span className="text-accent">آنلاین</span>
            ) : conversation.otherParticipant?.lastSeen ? (
              <span>آخرین بازدید {relativeTime(conversation.otherParticipant.lastSeen)}</span>
            ) : (
              <span>آفلاین</span>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto chat-bg p-4">
        {hasMore && (
          <div className="text-center mb-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {loadingMore ? 'در حال بارگذاری...' : 'بارگذاری پیام‌های قدیمی‌تر'}
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><div className="loader" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>گفتگو را شروع کنید! یک پیام بفرستید.</p>
          </div>
        ) : (
          [...messages].reverse().map((m) => (
            <MessageBubble key={m.id} message={m} isMine={m.senderId === currentUser.id} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload preview */}
      {uploadState && (
        <div className="bg-white dark:bg-gray-800 px-4 py-2 border-t dark:border-gray-700 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1 truncate">{uploadState.name}</div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${uploadState.percent}%` }} />
            </div>
          </div>
          <span className="text-xs text-gray-500">{uploadState.percent}%</span>
          <button onClick={cancelUpload} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="bg-white dark:bg-gray-800 px-3 py-2 flex items-end gap-2 border-t dark:border-gray-700">
        <label className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
          <Paperclip size={20} className="text-gray-500" />
          <input type="file" className="hidden" onChange={onFileSelect} disabled={!!uploadState} />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="پیام بنویسید..."
          rows={1}
          className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2.5 resize-none outline-none text-sm max-h-32"
        />
        <button
          onClick={send}
          disabled={sending || (!text.trim() && !uploadState)}
          className="bg-accent text-white p-2.5 rounded-full hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? <div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
}
