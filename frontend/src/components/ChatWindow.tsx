import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { chatSocket } from '../services/socket';
import { uploadFile, type UploadProgress } from '../services/uploader';
import toast from 'react-hot-toast';
import type { Conversation, Message, User } from '../types';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import { relativeTime } from '../utils';
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
  const shouldScrollRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ items: Message[] }>(`/conversations/${conversation.id}/messages`, {
        params: { page: 1, pageSize: PAGE_SIZE },
      });
      // API returns newest-first. We want oldest-first for display, so reverse.
      // After reverse, index 0 = oldest, last index = newest.
      const sorted = [...data.items].reverse();
      setMessages(sorted);
      if (sorted.length > 0) {
        const oldest = sorted[0].createdAt;
        setOldestAt(oldest);
        setHasMore(data.items.length >= PAGE_SIZE);
      }
      // Mark as delivered
      api.post(`/conversations/${conversation.id}/delivered`).catch(() => {});
      setTimeout(() => scrollToBottom(false), 100);
    } catch {} finally { setLoading(false); }
  }, [conversation.id, scrollToBottom]);

  useEffect(() => {
    loadMessages();
    setOtherTyping(false);

    const offReceive = chatSocket.on('message:receive', (data: any) => {
      if (data.conversationId !== conversation.id) return;
      // Fetch the new message and append to the end (oldest→newest order)
      api.get<{ items: Message[] }>(`/conversations/${conversation.id}/messages`, { params: { pageSize: 1 } })
        .then(({ data }) => {
          if (data.items.length > 0) {
            const newMsg = data.items[0];
            setMessages((prev) => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];  // append to end (newest at bottom)
            });
            chatSocket.emit('message:delivered', { conversationId: conversation.id, messageId: newMsg.id });
            setTimeout(() => scrollToBottom(), 100);
          }
        })
        .catch(() => {});
    });

    const offConvUpdated = chatSocket.on('conversation:updated', (data: any) => {
      if (data.conversationId !== conversation.id) return;
      // A message was sent — fetch it if we don't already have it
      if (data.messageId && data.senderId !== currentUser.id) {
        // The message:receive handler will fetch it; no-op here.
      }
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

    return () => {
      offReceive();
      offConvUpdated();
      offTyping();
      offStop();
      offDelivered();
      offRead();
    };
  }, [conversation.id, currentUser.id, loadMessages, scrollToBottom]);

  // Track whether user is at the bottom (so we know to auto-scroll on new messages)
  const onScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldScrollRef.current = distanceFromBottom < 100;
  };

  const loadMore = async () => {
    if (!oldestAt || loadingMore) return;
    setLoadingMore(true);
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;
    try {
      const { data } = await api.get<{ items: Message[] }>(`/conversations/${conversation.id}/messages/before`, {
        params: { before: oldestAt, pageSize: PAGE_SIZE },
      });
      if (data.items.length > 0) {
        // API returns newest-first; reverse to oldest-first, then prepend to existing
        const older = [...data.items].reverse();
        setMessages((prev) => [...older, ...prev]);
        const newOldest = older[0].createdAt;
        setOldestAt(newOldest);
        setHasMore(data.items.length >= PAGE_SIZE);
        // Preserve scroll position
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
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
    shouldScrollRef.current = true;
    try {
      const { data: msg } = await api.post<Message>(`/conversations/${conversation.id}/messages`, {
        content, type: 'TEXT',
      });
      // Append to the end (newest at bottom)
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
    shouldScrollRef.current = true;

    try {
      const attachmentId = await uploadFile(
        file,
        (p: UploadProgress) => setUploadState({ name: file.name, percent: p.percent }),
        controller.signal,
      );
      const type = file.type.startsWith('image/') ? 'IMAGE'
        : file.type.startsWith('video/') ? 'VIDEO'
        : file.type.startsWith('audio/') ? 'AUDIO'
        : 'FILE';
      const { data: msg } = await api.post<Message>(`/conversations/${conversation.id}/messages`, {
        content: '', type, attachmentId,
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
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
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
              <motion.span
                className="text-accent inline-flex items-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                در حال نوشتن
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >...</motion.span>
              </motion.span>
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
      <div ref={containerRef} onScroll={onScroll} className="flex-1 overflow-y-auto chat-bg p-4">
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
          // Render messages in chronological order (oldest first → newest last)
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <MessageBubble message={m} isMine={m.senderId === currentUser.id} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload preview */}
      <AnimatePresence>
        {uploadState && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-gray-800 px-4 py-2 border-t dark:border-gray-700 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-1 truncate">{uploadState.name}</div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    animate={{ width: `${uploadState.percent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-500">{uploadState.percent}%</span>
              <button onClick={cancelUpload} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={send}
          disabled={sending || (!text.trim() && !uploadState)}
          className="bg-accent text-white p-2.5 rounded-full hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? <div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Send size={20} />}
        </motion.button>
      </div>
    </motion.div>
  );
}
