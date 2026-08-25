'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat';

/**
 * Polling fallback hook for real-time message delivery.
 *
 * WhatsApp Web uses a similar pattern: WebSocket as primary transport,
 * with periodic polling as a backup. This ensures messages are delivered
 * even when:
 * - WebSocket is disconnected
 * - WebSocket service is not running
 * - User is behind a firewall/proxy that blocks WS
 * - Peer is offline and reconnects later
 *
 * Polls every 3 seconds when:
 * - A conversation is active
 * - The WebSocket is disconnected (fallback mode)
 * - OR always (as backup to WS, to catch any missed events)
 */
const POLL_INTERVAL = 3000; // 3 seconds

export function usePollingFallback() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const wsConnected = useChatStore((s) => s.wsConnected);
  const pollNewMessages = useChatStore((s) => s.pollNewMessages);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Poll immediately when conversation changes
    pollNewMessages(activeConversationId);

    // Set up periodic polling
    // If WS is connected, poll less frequently (every 10s as backup)
    // If WS is disconnected, poll aggressively (every 3s)
    const interval = wsConnected ? 10000 : POLL_INTERVAL;

    timerRef.current = setInterval(() => {
      pollNewMessages(activeConversationId);
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeConversationId, wsConnected, pollNewMessages]);

  // Periodically refresh conversation list (for unread counts, new conversations)
  useEffect(() => {
    // Initial load
    loadConversations().catch(() => {});

    // Refresh every 15 seconds
    convTimerRef.current = setInterval(() => {
      loadConversations().catch(() => {});
    }, 15000);

    return () => {
      if (convTimerRef.current) {
        clearInterval(convTimerRef.current);
        convTimerRef.current = null;
      }
    };
  }, [loadConversations]);

  // Also poll when window gains focus (user returns to tab)
  useEffect(() => {
    const onFocus = () => {
      if (activeConversationId) {
        pollNewMessages(activeConversationId);
      }
      loadConversations().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [activeConversationId, pollNewMessages, loadConversations]);
}
