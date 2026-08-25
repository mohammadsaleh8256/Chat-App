'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/store/chat';
import { useRouter } from '@/lib/router';
import type { ConversationSummary } from '@/types';
import {
  formatRelativeTime,
  getInitials,
  avatarColor,
  toPersianDigits,
} from '@/lib/api';
import { Search, MessageSquarePlus, LogOut, Shield, Settings } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSocket } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';

export function ConversationList() {
  const { push } = useRouter();
  const { conversations, loadingConversations, loadConversations, selectConversation, activeConversationId, startConversationWith } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; fullName: string; phone: string; avatarUrl?: string | null }>>([]);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadConversations().catch(() => {
      toast.error('خطا در بارگذاری گفتگوها');
    });
  }, [loadConversations]);

  // Debounced user search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) {
      return;
    }
    const term = search.trim();
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api<{ users: typeof searchResults }>(
          `/api/users/search?q=${encodeURIComponent(term)}`
        );
        setSearchResults(res.users);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }, [search]);

  const onConversationClick = (c: ConversationSummary) => {
    selectConversation(c.id);
    push({ name: 'chat', conversationId: c.id });
  };

  const onStartConversation = async (userId: string) => {
    try {
      const convId = await startConversationWith(userId);
      setNewChatOpen(false);
      setSearch('');
      push({ name: 'chat', conversationId: convId });
    } catch {
      toast.error('خطا در ایجاد گفتگو');
    }
  };

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    return conversations.filter((c) => c.title.includes(search.trim()));
  }, [conversations, search]);

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="w-10 h-10">
              {user?.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.fullName} />
              ) : null}
              <AvatarFallback className={avatarColor(user?.id || '')}>
                {user ? getInitials(user.fullName) : '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">{user?.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {user?.role === 'ADMIN' && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => push({ name: 'admin', tab: 'dashboard' })}
                title="پنل مدیریت"
              >
                <Shield className="w-4 h-4" />
              </Button>
            )}
            <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" title="گفتگوی جدید">
                  <MessageSquarePlus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>گفتگوی جدید</DialogTitle>
                  <DialogDescription>کاربر مورد نظر را جستجو کنید</DialogDescription>
                </DialogHeader>
                <NewChatSearch
                  search={search}
                  setSearch={setSearch}
                  results={searchResults}
                  onSelect={onStartConversation}
                />
              </DialogContent>
            </Dialog>
            <Button
              size="icon"
              variant="ghost"
              onClick={async () => {
                await logout();
                push({ name: 'auth', mode: 'login' });
              }}
              title="خروج"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی گفتگوها..."
            className="pr-9 bg-background"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loadingConversations ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
            <MessageSquarePlus className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">هنوز گفتگویی ندارید</p>
            <p className="text-xs mt-1">برای شروع روی + بزنید</p>
          </div>
        ) : (
          <ul className="space-y-0.5 p-1.5">
            {filteredConversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeConversationId}
                onClick={() => onConversationClick(c)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  active,
  onClick,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-right hover:bg-accent',
          active && 'bg-accent'
        )}
      >
        <Avatar className="w-12 h-12 shrink-0">
          {conversation.avatarUrl && (
            <AvatarImage src={conversation.avatarUrl} alt={conversation.title} />
          )}
          <AvatarFallback className={avatarColor(conversation.id)}>
            {getInitials(conversation.title)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm truncate">{conversation.title}</p>
            {conversation.lastMessage && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatRelativeTime(conversation.lastMessage.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate flex-1">
              {conversation.lastMessage ? (
                <>
                  {conversation.lastMessage.isOwn && 'شما: '}
                  {conversation.lastMessage.body || '📎 فایل'}
                </>
              ) : (
                <span className="italic opacity-60">گفتگوی جدید</span>
              )}
            </p>
            {conversation.unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center">
                {toPersianDigits(conversation.unreadCount)}
              </Badge>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function NewChatSearch({
  search,
  setSearch,
  results,
  onSelect,
}: {
  search: string;
  setSearch: (v: string) => void;
  results: Array<{ id: string; fullName: string; phone: string; avatarUrl?: string | null }>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="شماره یا نام کاربر..."
          className="pr-9"
          autoFocus
        />
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {search ? 'کاربری یافت نشد' : 'برای جستجو تایپ کنید'}
        </p>
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {results.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => onSelect(u.id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-right"
              >
                <Avatar className="w-10 h-10">
                  {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                  <AvatarFallback className={avatarColor(u.id)}>
                    {getInitials(u.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.fullName}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{u.phone}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
