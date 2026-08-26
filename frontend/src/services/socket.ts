import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './api';

type EventHandler = (...args: any[]) => void;

class ChatSocket {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private reconnecting = false;

  connect(): Socket | null {
    // If already connected, return the existing socket
    if (this.socket?.connected) return this.socket;

    const token = tokenStorage.getAccess();
    if (!token) return null;

    // If socket exists but is disconnected, tear it down before creating a new one
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io('/', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Forward all events to registered listeners
    const events = [
      'message:receive', 'message:delivered', 'message:read', 'message:delete',
      'typing:start', 'typing:stop',
      'user:online', 'user:offline',
      'conversation:updated', 'conversation:joined', 'conversation:left',
      'auth:error', 'connect', 'disconnect', 'reconnect', 'reconnect_attempt',
    ];
    events.forEach((event) => {
      this.socket!.on(event, (...args: any[]) => this.dispatch(event, ...args));
    });

    // On reconnect, fetch fresh token (in case it expired)
    this.socket.on('reconnect_attempt', () => {
      const fresh = tokenStorage.getAccess();
      if (fresh && this.socket) {
        this.socket.auth = { token: fresh };
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  private dispatch(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(...args); } catch (e) { console.error(`Socket listener error for ${event}:`, e); }
    });
  }

  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}

export const chatSocket = new ChatSocket();
