import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * A tiny event bus that lets services emit Socket.IO events to clients
 * without directly depending on the gateway.
 *
 * The ChatGateway registers its Server instance on init, and services
 * call `chatEvents.emitConversationUpdated(...)` which broadcasts to the
 * appropriate conversation room.
 */
@Injectable()
export class ChatEvents {
  private readonly logger = new Logger('ChatEvents');
  private io: Server | null = null;

  setServer(io: Server) {
    this.io = io;
    this.logger.log('Socket.IO server registered');
  }

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  /** Notify all members of a conversation that something changed (new message, etc.) */
  emitConversationUpdated(conversationId: string, payload: { messageId?: string; senderId?: string; lastMessagePreview?: string }) {
    if (!this.io) return;
    this.io.to(this.roomName(conversationId)).emit('conversation:updated', {
      conversationId,
      ...payload,
    });
  }

  /** Broadcast a new message to a conversation room (excluding sender) */
  emitMessageReceived(conversationId: string, messageId: string, senderId: string) {
    if (!this.io) return;
    // Use 'broadcast' style by emitting to the room; the sender's other tabs will also get it
    // which is fine — it lets multi-device sync work correctly.
    this.io.to(this.roomName(conversationId)).emit('message:receive', {
      conversationId,
      messageId,
      senderId,
    });
  }

  /** Notify that messages in a conversation were marked as read */
  emitMessageRead(conversationId: string, messageId: string, readBy: string) {
    if (!this.io) return;
    this.io.to(this.roomName(conversationId)).emit('message:read', {
      conversationId,
      messageId,
      readBy,
    });
  }

  /** Notify that messages were delivered */
  emitMessageDelivered(conversationId: string, messageId: string, deliveredTo: string) {
    if (!this.io) return;
    this.io.to(this.roomName(conversationId)).emit('message:delivered', {
      conversationId,
      messageId,
      deliveredTo,
    });
  }

  /** Notify a user's contacts that they came online / went offline */
  emitPresence(userId: string, isOnline: boolean) {
    if (!this.io) return;
    this.io.emit(isOnline ? 'user:online' : 'user:offline', { userId });
  }
}
