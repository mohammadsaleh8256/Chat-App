/**
 * Shared TypeScript types for client-server communication.
 */

export interface SafeUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  lastSeenAt: string;
  isOnline?: boolean;
}

export interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  avatarUrl: string | null;
  lastMessage?: {
    id: string;
    body: string | null;
    type: string;
    senderName: string;
    createdAt: string;
    isOwn: boolean;
  } | null;
  unreadCount: number;
  lastReadAt: string;
  updatedAt: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  thumbnailUrl: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  downloadUrl: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string | null;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
  replyTo?: {
    id: string;
    body: string | null;
    senderName: string;
  } | null;
  forwardedFrom?: {
    id: string;
    senderName: string;
  } | null;
  attachments: MessageAttachment[];
  isDeleted: boolean;
  deletedForEveryone: boolean;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
}

export interface WSEvent<T = unknown> {
  type: string;
  data: T;
}

export interface WSMessageNew {
  message: ChatMessage;
}

export interface WSPresence {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string;
}

export interface WSTyping {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface WSReceipt {
  messageId: string;
  conversationId: string;
  userId: string;
  status: 'DELIVERED' | 'READ';
}

export interface WSConversationUpdate {
  conversation: ConversationSummary;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}
