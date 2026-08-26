import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { ChatEvents } from '../events/chat-events';
import { JwtService } from '@nestjs/jwt';

interface SocketUser {
  userId: string;
  phoneNumber: string;
  role: 'USER' | 'ADMIN';
  jwtId: string;
}

@WebSocketGateway({
  namespace: '/',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('ChatGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly chatEvents: ChatEvents,
  ) {}

  afterInit() {
    this.logger.log('Socket.IO gateway initialized at /');
    // Wire the server into the ChatEvents bus so services can emit events
    this.chatEvents.setServer(this.server);
  }

  /**
   * Authenticate the socket on connection using the access_token query param.
   * Reject the connection if invalid.
   */
  async handleConnection(client: Socket, ..._args: any[]) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.access_token;
      if (!token || typeof token !== 'string') {
        client.emit('auth:error', { message: 'Token missing' });
        client.disconnect(true);
        return;
      }

      const payload: any = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.deletedAt || user.status !== 'ACTIVE') {
        client.emit('auth:error', { message: 'Account unavailable' });
        client.disconnect(true);
        return;
      }

      (client.data as any).user = {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        jwtId: payload.jti,
      } as SocketUser;

      // Auto-join all conversation rooms the user is a member of
      const conversations = await this.prisma.conversationParticipant.findMany({
        where: { userId: user.id, leftAt: null },
        select: { conversationId: true },
      });
      for (const { conversationId } of conversations) {
        await client.join(this.roomName(conversationId));
      }

      const wasOffline = await this.presence.userConnected(user.id, client.id);
      if (wasOffline) {
        // Broadcast presence to everyone — clients will filter for relevant conversations
        this.chatEvents.emitPresence(user.id, true);
      }

      this.logger.log(`Connected: ${user.phoneNumber} (${client.id})`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${(err as Error).message}`);
      client.emit('auth:error', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = (client.data as any).user as SocketUser | undefined;
    if (!user) return;
    const wentOffline = await this.presence.userDisconnected(user.userId, client.id);
    if (wentOffline) {
      this.chatEvents.emitPresence(user.userId, false);
    }
    this.logger.log(`Disconnected: ${user.phoneNumber} (${client.id})`);
  }

  // ====== Client→Server events ======

  @SubscribeMessage('conversation:join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user = this.getUser(client);
    if (!user) return;
    const isMember = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId: data.conversationId, userId: user.userId, leftAt: null },
    });
    if (!isMember) {
      client.emit('error', { message: 'شما به این گفتگو دسترسی ندارید.' });
      return;
    }
    await client.join(this.roomName(data.conversationId));
    client.emit('conversation:joined', { conversationId: data.conversationId });
  }

  @SubscribeMessage('conversation:leave')
  async onLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    await client.leave(this.roomName(data.conversationId));
    client.emit('conversation:left', { conversationId: data.conversationId });
  }

  @SubscribeMessage('typing:start')
  async onTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user = this.getUser(client);
    if (!user) return;
    const isMember = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId: data.conversationId, userId: user.userId, leftAt: null },
    });
    if (!isMember) return;
    client.to(this.roomName(data.conversationId)).emit('typing:start', {
      conversationId: data.conversationId,
      userId: user.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user = this.getUser(client);
    if (!user) return;
    client.to(this.roomName(data.conversationId)).emit('typing:stop', {
      conversationId: data.conversationId,
      userId: user.userId,
    });
  }

  /**
   * Notify a conversation that a new message was sent. The actual persistence
   * is done via the REST API; the sender calls this event afterwards so other
   * participants receive the message in real time.
   */
  @SubscribeMessage('message:send')
  async onMessageSend(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string; messageId: string }) {
    const user = this.getUser(client);
    if (!user) return;
    const isMember = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId: data.conversationId, userId: user.userId, leftAt: null },
    });
    if (!isMember) return;
    // Broadcast to other members of the conversation (excluding sender's own socket)
    client.to(this.roomName(data.conversationId)).emit('message:receive', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      senderId: user.userId,
    });
    // Also notify conversation:updated so the conversation list reorders
    this.chatEvents.emitConversationUpdated(data.conversationId, {
      messageId: data.messageId,
      senderId: user.userId,
    });
  }

  @SubscribeMessage('message:delivered')
  async onMessageDelivered(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string; messageId: string }) {
    const user = this.getUser(client);
    if (!user) return;
    this.server.to(this.roomName(data.conversationId)).emit('message:delivered', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      deliveredTo: user.userId,
    });
  }

  @SubscribeMessage('message:read')
  async onMessageRead(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string; messageId: string }) {
    const user = this.getUser(client);
    if (!user) return;
    this.server.to(this.roomName(data.conversationId)).emit('message:read', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      readBy: user.userId,
    });
  }

  // ====== Helpers ======

  private getUser(client: Socket): SocketUser | undefined {
    return (client.data as any).user;
  }

  private roomName(conversationId: string): string {
    return `conversation:${conversationId}`;
  }
}
