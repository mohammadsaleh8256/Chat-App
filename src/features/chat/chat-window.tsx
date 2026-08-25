'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, MoreVertical, Phone, Video, Search } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { useChatStore } from '@/store/chat';
import { useSocket } from '@/hooks/use-socket';
import { useRouter } from '@/lib/router';
import type { ChatMessage } from '@/types';
import { api, avatarColor, formatTime, getInitials, formatRelativeTime } from '@/lib/api';
import { toast } from 'sonner';

interface ChatWindowProps {
  conversationId: string;
  onBack: () => void;
}

export function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
  const { messages, loadingMessages, loadMessages, sendMessage, deleteMessage } = useChatStore();
  const conversations = useChatStore((s) => s.conversations);
  const presence = useChatStore((s) => s.presence);
  const typing = useChatStore((s) => s.typing);
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages);
  const { joinConversation, leaveConversation, emitRead } = useSocket();
  const { push } = useRouter();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastScrollHeight = useRef(0);

  const convMessages = messages[conversationId] || [];
  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId]
  );

  // Other user (for direct chat)
  const otherUserId = useMemo(() => {
    // Best-effort: get from last message sender
    const otherMsg = convMessages.find((m) => !m.isOwn);
    return otherMsg?.senderId;
  }, [convMessages]);

  const otherPresence = otherUserId ? presence[otherUserId] : undefined;
  const isTyping = otherUserId && typing[conversationId]?.[otherUserId];

  // Load messages when conversation changes (only on conversationId change, not on socket callback identity change)
  const joinRef = useRef(joinConversation);
  const leaveRef = useRef(leaveConversation);
  joinRef.current = joinConversation;
  leaveRef.current = leaveConversation;

  useEffect(() => {
    loadMessages(conversationId).catch(() => {
      toast.error('خطا در بارگذاری پیام‌ها');
    });
    setHasMore(true);
    setReplyTo(null);
    joinRef.current(conversationId);
    return () => {
      leaveRef.current(conversationId);
    };
  }, [conversationId, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && !loadingMore) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convMessages.length, loadingMore]);

  // Infinite scroll: load more when reaching top
  const onScroll = async () => {
    if (!scrollRef.current || !hasMore || loadingMore || loadingMessages) return;
    const el = scrollRef.current;
    if (el.scrollTop < 50) {
      setLoadingMore(true);
      lastScrollHeight.current = el.scrollHeight;
      const firstMsg = convMessages[0];
      if (firstMsg) {
        try {
          const more = await loadMoreMessages(conversationId, firstMsg.createdAt);
          setHasMore(more);
        } catch {
          toast.error('خطا در بارگذاری پیام‌های قدیمی‌تر');
        } finally {
          setLoadingMore(false);
          // Preserve scroll position after loading
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              const diff = scrollRef.current.scrollHeight - lastScrollHeight.current;
              scrollRef.current.scrollTop = diff;
            }
          });
        }
      }
    }
  };

  const onReply = (msg: ChatMessage) => setReplyTo(msg);
  const onForward = (msg: ChatMessage) => {
    setForwardingMessage(msg);
    toast.info('انتخاب گفتگو برای فوروارد');
    // Navigate to conversation list to choose target
    push({ name: 'chat' });
  };
  const onDelete = async (msg: ChatMessage) => {
    try {
      await deleteMessage(msg.id);
      toast.success('پیام حذف شد');
    } catch {
      toast.error('خطا در حذف پیام');
    }
  };

  // Determine if message should show sender avatar/name (groups)
  const isGroup = conversation?.type === 'GROUP';

  return (
    <div className="flex flex-col h-full chat-bg-pattern">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border glass shrink-0">
        <Button size="icon" variant="ghost" onClick={onBack} className="md:hidden">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          {conversation?.avatarUrl && (
            <AvatarImage src={conversation.avatarUrl} alt={conversation?.title || ''} />
          )}
          <AvatarFallback className={avatarColor(conversationId)}>
            {conversation ? getInitials(conversation.title) : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{conversation?.title || 'گفتگو'}</p>
          <p className="text-xs text-muted-foreground">
            {isTyping
              ? 'در حال تایپ...'
              : otherPresence
              ? otherPresence.isOnline
                ? 'آنلاین'
                : `آخرین بازدید ${formatRelativeTime(otherPresence.lastSeenAt)}`
              : ''}
          </p>
        </div>
        <Button size="icon" variant="ghost" title="تماس صوتی" disabled>
          <Phone className="w-5 h-5" />
        </Button>
        <Button size="icon" variant="ghost" title="تماس تصویری" disabled>
          <Video className="w-5 h-5" />
        </Button>
        <Button size="icon" variant="ghost" title="جستجو" disabled>
          <Search className="w-5 h-5" />
        </Button>
        <Button size="icon" variant="ghost" title="بیشتر" disabled>
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {loadingMessages ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-12 w-2/3 ${i % 2 ? 'mr-auto' : 'ml-auto'}`} />
            ))}
          </div>
        ) : convMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
            <p className="text-sm">شروع گفتگو</p>
            <p className="text-xs mt-1">اولین پیام خود را ارسال کنید</p>
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="text-center py-2 text-xs text-muted-foreground">
                در حال بارگذاری پیام‌های قدیمی...
              </div>
            )}
            {convMessages.map((msg, i) => {
              const prev = convMessages[i - 1];
              const showSender =
                !prev ||
                prev.senderId !== msg.senderId ||
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isGroup={isGroup}
                  showSender={showSender}
                  onReply={() => onReply(msg)}
                  onForward={() => onForward(msg)}
                  onDelete={() => onDelete(msg)}
                />
              );
            })}
            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-3">
                <div className="flex gap-1 bg-muted rounded-full px-3 py-1.5">
                  <span className="typing-dot w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                  <span className="typing-dot w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                  <span className="typing-dot w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput
        conversationId={conversationId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
