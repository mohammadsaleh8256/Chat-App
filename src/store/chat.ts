'use client';

import { create } from 'zustand';
import type { ChatMessage, ConversationSummary, WSPresence, WSTyping, WSReceipt } from '@/types';
import { api } from '@/lib/api';

interface ChatState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>; // conversationId -> messages
  loadingConversations: boolean;
  loadingMessages: boolean;
  typing: Record<string, Record<string, boolean>>; // conversationId -> userId -> isTyping
  presence: Record<string, { isOnline: boolean; lastSeenAt: string }>; // userId -> presence

  loadConversations: () => Promise<void>;
  selectConversation: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  loadMoreMessages: (conversationId: string, cursor: string) => Promise<boolean>;
  sendMessage: (conversationId: string, body: string, opts?: { replyToId?: string; attachmentIds?: string[] }) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  startConversationWith: (userId: string) => Promise<string>;

  // WS event handlers
  onMessageNew: (msg: ChatMessage) => void;
  onMessageDeleted: (messageId: string, conversationId: string) => void;
  onReceiptUpdate: (data: WSReceipt) => void;
  onTyping: (data: WSTyping) => void;
  onPresence: (data: WSPresence) => void;
  onConversationUpdate: (conversationId: string) => Promise<void>;

  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  loadingConversations: false,
  loadingMessages: false,
  typing: {},
  presence: {},

  loadConversations: async () => {
    set({ loadingConversations: true });
    try {
      const data = await api<{ conversations: ConversationSummary[] }>('/api/conversations');
      set({ conversations: data.conversations, loadingConversations: false });
    } catch (err) {
      set({ loadingConversations: false });
      throw err;
    }
  },

  selectConversation: (id) => set({ activeConversationId: id }),

  loadMessages: async (conversationId) => {
    set({ loadingMessages: true });
    try {
      const data = await api<{ messages: ChatMessage[]; nextCursor: string | null }>(
        `/api/conversations/${conversationId}/messages?limit=30`
      );
      set((state) => ({
        messages: { ...state.messages, [conversationId]: data.messages.reverse() },
        loadingMessages: false,
      }));
    } catch (err) {
      set({ loadingMessages: false });
      throw err;
    }
  },

  loadMoreMessages: async (conversationId, cursor) => {
    const data = await api<{ messages: ChatMessage[]; nextCursor: string | null }>(
      `/api/conversations/${conversationId}/messages?limit=30&cursor=${encodeURIComponent(cursor)}`
    );
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...data.messages.reverse(), ...(state.messages[conversationId] || [])],
      },
    }));
    return data.nextCursor !== null;
  },

  sendMessage: async (conversationId, body, opts) => {
    const res = await api<{ message: ChatMessage }>(
      `/api/conversations/${conversationId}/messages`,
      { method: 'POST', json: { body, replyToId: opts?.replyToId, attachments: opts?.attachmentIds } }
    );
    // Optimistic add (it will be re-confirmed by WS echo, but dedupe by id)
    set((state) => {
      const existing = state.messages[conversationId] || [];
      if (existing.some((m) => m.id === res.message.id)) return state;
      return {
        messages: { ...state.messages, [conversationId]: [...existing, res.message] },
      };
    });
  },

  deleteMessage: async (messageId) => {
    await api(`/api/messages/${messageId}`, { method: 'DELETE' });
    set((state) => {
      const newMessages: Record<string, ChatMessage[]> = {};
      for (const [convId, msgs] of Object.entries(state.messages)) {
        newMessages[convId] = msgs.filter((m) => m.id !== messageId);
      }
      return { messages: newMessages };
    });
  },

  startConversationWith: async (userId) => {
    const res = await api<{ conversation: ConversationSummary }>('/api/conversations', {
      method: 'POST',
      json: { participantId: userId, type: 'DIRECT' },
    });
    set((state) => {
      const exists = state.conversations.find((c) => c.id === res.conversation.id);
      return {
        conversations: exists ? state.conversations : [res.conversation, ...state.conversations],
      };
    });
    return res.conversation.id;
  },

  onMessageNew: (msg) => {
    set((state) => {
      const existing = state.messages[msg.conversationId] || [];
      if (existing.some((m) => m.id === msg.id)) return state;
      return {
        messages: { ...state.messages, [msg.conversationId]: [...existing, msg] },
      };
    });
    // Update lastMessage in conversation list
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === msg.conversationId
          ? {
              ...c,
              lastMessage: {
                id: msg.id,
                body: msg.body || (msg.attachments.length > 0 ? '📎 فایل' : ''),
                type: msg.type,
                senderName: msg.senderName,
                createdAt: msg.createdAt,
                isOwn: msg.isOwn,
              },
              updatedAt: msg.createdAt,
              unreadCount: msg.isOwn ? c.unreadCount : c.unreadCount + 1,
            }
          : c
      ),
    }));
  },

  onMessageDeleted: (messageId, conversationId) => {
    set((state) => {
      const msgs = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: msgs.filter((m) => m.id !== messageId),
        },
      };
    });
  },

  onReceiptUpdate: (data) => {
    set((state) => {
      const convMsgs = state.messages[data.conversationId];
      if (!convMsgs) return state;
      return {
        messages: {
          ...state.messages,
          [data.conversationId]: convMsgs.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  status:
                    data.status === 'READ'
                      ? 'READ'
                      : m.status === 'READ'
                      ? 'READ'
                      : 'DELIVERED',
                }
              : m
          ),
        },
      };
    });
  },

  onTyping: (data) => {
    set((state) => {
      const convTyping = state.typing[data.conversationId] || {};
      return {
        typing: {
          ...state.typing,
          [data.conversationId]: {
            ...convTyping,
            [data.userId]: data.isTyping,
          },
        },
      };
    });
    // Auto-clear after 3s
    if (data.isTyping) {
      setTimeout(() => {
        set((state) => {
          const convTyping = state.typing[data.conversationId] || {};
          return {
            typing: {
              ...state.typing,
              [data.conversationId]: {
                ...convTyping,
                [data.userId]: false,
              },
            },
          };
        });
      }, 3000);
    }
  },

  onPresence: (data) => {
    set((state) => ({
      presence: {
        ...state.presence,
        [data.userId]: { isOnline: data.isOnline, lastSeenAt: data.lastSeenAt },
      },
    }));
  },

  onConversationUpdate: async (conversationId) => {
    // Reload conversation list & the specific conversation
    try {
      await get().loadConversations();
    } catch {}
  },

  reset: () => set({
    conversations: [],
    activeConversationId: null,
    messages: {},
    typing: {},
    presence: {},
  }),
}));
