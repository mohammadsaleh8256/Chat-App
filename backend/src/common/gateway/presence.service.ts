import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Tracks active Socket.IO connections per user.
 * A user is "online" while they have at least one active connection.
 * The Map<userId, Set<connectionId>> is in-memory; on server restart all
 * users are reset to offline via the database (handled by ChatGateway).
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger('PresenceService');
  private readonly connections = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async userConnected(userId: string, connectionId: string): Promise<boolean> {
    let set = this.connections.get(userId);
    if (!set) {
      set = new Set();
      this.connections.set(userId, set);
    }
    set.add(connectionId);
    const wasOffline = set.size === 1;
    if (wasOffline) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      });
    }
    return wasOffline;
  }

  async userDisconnected(userId: string, connectionId: string): Promise<boolean> {
    const set = this.connections.get(userId);
    if (!set) return false;
    set.delete(connectionId);
    if (set.size === 0) {
      this.connections.delete(userId);
      await this.prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
      });
      return true; // user went offline
    }
    return false;
  }

  isOnline(userId: string): boolean {
    const set = this.connections.get(userId);
    return !!set && set.size > 0;
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.connections.keys()).filter((id) => {
      const set = this.connections.get(id);
      return set && set.size > 0;
    });
  }
}
