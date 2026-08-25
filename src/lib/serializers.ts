/**
 * Shared serialization helpers between API routes and frontend.
 */
import type { Attachment, Message, User, Conversation, ConversationParticipant, MessageReceipt, AdminAuditLog } from '@prisma/client';

export function toMessageType(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}

export function safeUser(u: User) {
  return {
    id: u.id,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    avatarUrl: u.avatarUrl,
    role: u.role,
    lastSeenAt: u.lastSeenAt.toISOString(),
  };
}

export function attachmentToPublic(a: Attachment & { message?: Message | null }) {
  return {
    id: a.id,
    fileName: a.fileName,
    originalName: a.originalName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    type: toMessageType(a.mimeType),
    thumbnailUrl: a.thumbnailPath ? `/api/files/${a.id}?thumb=1` : null,
    width: a.width,
    height: a.height,
    durationSec: a.durationSec,
    downloadUrl: `/api/files/${a.id}`,
  };
}

export function messageToPublic(
  m: Message & {
    sender: User;
    attachments: Attachment[];
    replyTo?: (Message & { sender: User }) | null;
    forwardedFrom?: (Message & { sender: User }) | null;
    receipts?: MessageReceipt[];
  },
  currentUserId: string
) {
  const otherReceipts = (m.receipts ?? []).filter((r) => r.userId !== currentUserId);
  const status: 'SENT' | 'DELIVERED' | 'READ' =
    otherReceipts.some((r) => r.status === 'READ') ? 'READ'
    : otherReceipts.some((r) => r.status === 'DELIVERED') ? 'DELIVERED'
    : 'SENT';

  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderName: `${m.sender.firstName} ${m.sender.lastName}`,
    senderAvatarUrl: m.sender.avatarUrl,
    body: m.body,
    type: m.type,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.body,
          senderName: `${m.replyTo.sender.firstName} ${m.replyTo.sender.lastName}`,
        }
      : null,
    forwardedFrom: m.forwardedFrom
      ? {
          id: m.forwardedFrom.id,
          senderName: `${m.forwardedFrom.sender.firstName} ${m.forwardedFrom.sender.lastName}`,
        }
      : null,
    attachments: m.attachments.map(attachmentToPublic),
    isDeleted: m.isDeleted,
    deletedForEveryone: m.deletedForEveryone,
    status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    isOwn: m.senderId === currentUserId,
  };
}

export function conversationToSummary(
  c: Conversation & {
    participants: (ConversationParticipant & { user: User })[];
    messages: (Message & { sender: User; attachments: Attachment[] })[];
  },
  currentUserId: string
) {
  const otherParticipants = c.participants.filter((p) => p.userId !== currentUserId);
  const lastMessage = c.messages[0];

  let title = c.title;
  let avatarUrl = c.avatarUrl;
  if (c.type === 'DIRECT' && otherParticipants[0]) {
    const op = otherParticipants[0].user;
    title = `${op.firstName} ${op.lastName}`;
    avatarUrl = op.avatarUrl;
  }

  const myParticipant = c.participants.find((p) => p.userId === currentUserId);
  const unreadCount = myParticipant
    ? c.messages.filter(
        (m) => m.createdAt > myParticipant.lastReadAt && m.senderId !== currentUserId
      ).length
    : 0;

  return {
    id: c.id,
    type: c.type,
    title: title || 'گفتگو',
    avatarUrl,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          type: lastMessage.type,
          senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
          createdAt: lastMessage.createdAt.toISOString(),
          isOwn: lastMessage.senderId === currentUserId,
        }
      : null,
    unreadCount,
    lastReadAt: myParticipant?.lastReadAt.toISOString() || new Date(0).toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function auditLogToPublic(a: AdminAuditLog & { actor: User; target?: User | null }) {
  return {
    id: a.id,
    actorId: a.actorId,
    actorName: `${a.actor.firstName} ${a.actor.lastName}`,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    targetUserId: a.targetUserId,
    metadata: a.metadata ? JSON.parse(a.metadata) : null,
    ipAddress: a.ipAddress,
    createdAt: a.createdAt.toISOString(),
  };
}
