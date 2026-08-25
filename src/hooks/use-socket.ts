'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';

interface UseSocketResult {
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  emitTyping: (conversationId: string, isTyping: boolean) => void;
  emitRead: (messageId: string, conversationId: string) => void;
}

const WS_PORT = process.env.NEXT_PUBLIC_WS_PORT || '3003';

let socketSingleton: Socket | null = null;

export function useSocket(): UseSocketResult {
  const user = useAuthStore((s) => s.user);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

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
      // Set initial connection state in a microtask to avoid setState-in-effect warning
      queueMicrotask(() => setIsConnected(socketSingleton?.connected ?? false));
      return;
    }

    // Get the session token from cookie (httpOnly, so we can't read it directly)
    // We need an endpoint to fetch a WS-token. For simplicity, use the auth/me cookie via
    // a separate ws-token endpoint... Actually, since the cookie is httpOnly we cannot read
    // it from JS. We need a /api/auth/ws-token endpoint that returns a short-lived token.
    // For simplicity in this MVP, we fetch /api/auth/me and use the cookie that's already sent.
    // But socket.io doesn't send cookies via fetch by default... actually it does, since we
    // use same-origin and withCredentials.
    const socket = io('/?XTransformPort=' + WS_PORT, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      withCredentials: true,
      auth: async (cb) => {
        // Fetch a one-time WS token from the server
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

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.warn('[ws] connect error', err.message);
      setIsConnected(false);
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
    const s = socketRef.current;
    if (s) s.emit('conversation:join', { conversationId });
  };

  const leaveConversation = (conversationId: string) => {
    const s = socketRef.current;
    if (s) s.emit('conversation:leave', { conversationId });
  };

  const emitTyping = (conversationId: string, isTyping: boolean) => {
    const s = socketRef.current;
    if (s) s.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  };

  const emitRead = (messageId: string, conversationId: string) => {
    const s = socketRef.current;
    if (s) s.emit('message:read', { messageId, conversationId });
  };

  return { isConnected, joinConversation, leaveConversation, emitTyping, emitRead };
}
