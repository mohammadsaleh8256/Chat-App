'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/store/chat';
import { useRouter } from '@/lib/router';
import { ConversationList } from '@/features/chat/conversation-list';
import { ChatWindow } from '@/features/chat/chat-window';
import { useSocket } from '@/hooks/use-socket';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

export function ChatScreen() {
  const { route, push } = useRouter();
  const { selectConversation, activeConversationId, loadConversations } = useChatStore();
  const { isConnected } = useSocket();

  const conversationId =
    route.name === 'chat' ? route.conversationId : undefined;

  useEffect(() => {
    if (conversationId) {
      selectConversation(conversationId);
    }
  }, [conversationId, selectConversation]);

  // Initial load
  useEffect(() => {
    loadConversations().catch(() => {
      toast.error('خطا در بارگذاری گفتگوها');
    });
  }, [loadConversations]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const showChatOnMobile = !!conversationId;
  const showListOnMobile = !conversationId;

  return (
    <div className="flex h-screen bg-background">
      {/* Connection indicator */}
      {!isConnected && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-xs px-3 py-1 rounded-full shadow-lg">
          در حال اتصال مجدد...
        </div>
      )}

      {/* Conversation list - desktop: always visible, mobile: only when no chat selected */}
      <div
        className={`${
          showListOnMobile ? 'flex' : 'hidden'
        } md:flex w-full md:w-80 lg:w-96 shrink-0`}
      >
        <ConversationList />
      </div>

      {/* Chat window - desktop: always visible, mobile: only when conversation selected */}
      <div
        className={`${
          showChatOnMobile ? 'flex' : 'hidden'
        } md:flex flex-1 min-w-0`}
      >
        {conversationId ? (
          <div className="flex-1">
            <ChatWindow
              conversationId={conversationId}
              onBack={() => push({ name: 'chat' })}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 chat-bg-pattern">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <MessageCircle className="w-12 h-12 text-primary/60" />
      </div>
      <h2 className="text-xl font-semibold mb-2">به چت‌گرام خوش آمدید</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        یک گفتگو را از منوی سمت راست انتخاب کنید تا پیام‌ها را ببینید، یا گفتگوی جدیدی را آغاز کنید.
      </p>
    </div>
  );
}
