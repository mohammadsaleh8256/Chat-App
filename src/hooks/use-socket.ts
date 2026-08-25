'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { usePollingFallback } from './use-polling-fallback';

interface UseSocketResult {
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  emitTyping: (conversationId: string, isTyping: boolean) => void;
  emitRead: (messageId: string, conversationId: string) => void;
}

const WS_PORT = process.env.NEXT_PUBLIC_WS_PORT || '3003';

// ============================================================
// Detect connection mode:
// - In sandbox (preview-z.ai): use Caddy gateway with XTransformPort query param
//   e.g. io('/?XTransformPort=3003')
// - In local dev (localhost / 127.0.0.1 / custom domain): connect DIRECTLY to WS port
//   e.g. io('http://localhost:3003')
//
// We detect sandbox by checking hostname. The sandbox uses a *.space-z.ai domain.
// Everything else is treated as local dev.
// ============================================================
function getSocketUrl(): string {
  if (typeof window === 'undefined') return ''; // SSR safe
  const { hostname } = window.location;
  // Sandbox preview uses space-z.ai domain
  const isSandbox = hostname.includes('space-z.ai') || hostname.includes('preview-');
  if (isSandbox) {
    // Use same origin + query param for Caddy gateway routing
    return ''; // empty string = same origin
  }
  // Local dev: connect directly to the WS service port
  return `http://${hostname}:${WS_PORT}`;
}

function getSocketPath(): string {
  if (typeof window === 'undefined') return '/';
  const { hostname } = window.location;
  const isSandbox = hostname.includes('space-z.ai') || hostname.includes('preview-');
  if (isSandbox) {
    // Caddy gateway requires the query param + path '/'
    return '/?XTransformPort=' + WS_PORT;
  }
  // Direct connection: just use root path
  return '/';
}

let socketSingleton: Socket | null = null;

export function useSocket(): UseSocketResult {
  const user = useAuthStore((s) => s.user);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const setWsConnected = useChatStore((s) => s.setWsConnected);

  // Always run the polling fallback (it's a no-op when WS is connected and recent)
  usePollingFallback();

  const onMessageNew = useChatStore((s) => s.onMessageNew);
  const onMessageDeleted = useChatStore((s) => s.onMessageDeleted);
  const onReceiptUpdate = useChatStore((s) => s.onReceiptUpdate);
  const onTyping = useChatStore((s) => s.onTyping);
  const onPresence = useChatStore((s) => s.onPresence);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socketSingleton = null;
      }
      return;
    }

    // Reuse singleton
    if (socketSingleton) {
      socketRef.current = socketSingleton;
      queueMicrotask(() => setIsConnected(socketSingleton?.connected ?? false));
      return;
    }

    const url = getSocketUrl();
    const path = getSocketPath();
    const isSandbox = path.includes('XTransformPort');

    console.log('[ws] connecting to:', isSandbox ? `${window.location.origin}${path}` : `${url}${path}`);

    const socket = io(url, {
      path: isSandbox ? '/' : '/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      withCredentials: true,
      // For sandbox: pass XTransformPort as query param
      query: isSandbox ? { XTransformPort: WS_PORT } : undefined,
      auth: async (cb) => {
        try {
          const res = await fetch('/api/auth/ws-token');
          if (res.ok) {
            const data = await res.json();
            cb({ token: data.token });
          } else {
            cb({ token: '' });
          }
        } catch {
          cb({ token: '' });
        }
      },
    });

    socketRef.current = socket;
    socketSingleton = socket;

    socket.on('connect', () => {
      console.log('[ws] connected');
      setIsConnected(true);
      setWsConnected(true);
    });
    socket.on('disconnect', () => {
      console.log('[ws] disconnected');
      setIsConnected(false);
      setWsConnected(false);
    });
    socket.on('connect_error', (err) => {
      console.warn('[ws] connect error:', err.message);
      setIsConnected(false);
      setWsConnected(false);
    });

    socket.on('message:new', (data: { message: Parameters<typeof onMessageNew>[0] }) => {
      onMessageNew(data.message);
    });

    socket.on('message:deleted', (data: { messageId: string; conversationId: string }) => {
      onMessageDeleted(data.messageId, data.conversationId);
    });

    socket.on('message:read', (data: Parameters<typeof onReceiptUpdate>[0]) => {
      onReceiptUpdate(data);
    });

    socket.on('message:delivered', (data: Parameters<typeof onReceiptUpdate>[0]) => {
      onReceiptUpdate(data);
    });

    socket.on('typing:start', (data: Parameters<typeof onTyping>[0]) => {
      onTyping({ ...data, isTyping: true });
    });

    socket.on('typing:stop', (data: Parameters<typeof onTyping>[0]) => {
      onTyping({ ...data, isTyping: false });
    });

    socket.on('user:online', (data: Parameters<typeof onPresence>[0]) => {
      onPresence(data);
    });

    socket.on('user:offline', (data: Parameters<typeof onPresence>[0]) => {
      onPresence(data);
    });

    return () => {
      // Don't disconnect on unmount; keep alive across view changes
    };
  }, [user, onMessageNew, onMessageDeleted, onReceiptUpdate, onTyping, onPresence]);

  const joinConversation = (conversationId: string) => {
    const s = socketRef.current ?? socketSingleton;
    if (s) s.emit('conversation:join', { conversationId });
  };

  const leaveConversation = (conversationId: string) => {
    const s = socketRef.current ?? socketSingleton;
    if (s) s.emit('conversation:leave', { conversationId });
  };

  const emitTyping = (conversationId: string, isTyping: boolean) => {
    const s = socketRef.current ?? socketSingleton;
    if (s) s.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  };

  const emitRead = (messageId: string, conversationId: string) => {
    const s = socketRef.current ?? socketSingleton;
    if (s) s.emit('message:read', { messageId, conversationId });
  };

  return { isConnected, joinConversation, leaveConversation, emitTyping, emitRead };
}

/**
 * Standalone helper to emit typing events without using the useSocket hook.
 * Useful in components that don't need the full socket lifecycle but just
 * want to emit typing indicators.
 */
export function emitTypingEvent(conversationId: string, isTyping: boolean) {
  if (socketSingleton) {
    socketSingleton.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  }
}
