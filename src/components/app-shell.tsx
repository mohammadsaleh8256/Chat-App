'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useRouter } from '@/lib/router';
import { AuthScreen } from '@/features/auth/auth-screen';
import { ChatScreen } from '@/features/chat/chat-screen';
import { AdminScreen } from '@/features/admin/admin-screen';
import { Loader2 } from 'lucide-react';
import { useSocket } from '@/hooks/use-socket';

export function AppShell() {
  const { user, initialized, loading, init } = useAuthStore();
  const { route, push } = useRouter();

  // Initialize the WebSocket connection + polling fallback for all authenticated users.
  // This must be called at the top level (not in ChatScreen) so it persists across view changes.
  useSocket();

  useEffect(() => {
    if (!initialized) {
      init();
    }
  }, [initialized, init]);

  // Show loading screen while initializing
  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> show auth screen
  if (!user) {
    if (route.name !== 'auth') {
      push({ name: 'auth', mode: 'login' });
      return null;
    }
    return <AuthScreen initialMode={route.mode} />;
  }

  // Authenticated -> route based on hash
  if (route.name === 'admin') {
    return <AdminScreen />;
  }

  // Default: chat
  return <ChatScreen />;
}
