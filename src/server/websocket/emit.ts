/**
 * WebSocket emit bridge - HTTP bridge from API routes to the WS mini-service.
 * API routes can't emit directly via socket.io (which runs in a separate process),
 * so we POST an HTTP event to the WS service which then broadcasts.
 */
import { WEBSOCKET_BRIDGE_TOKEN } from './tokens';

const WS_PORT = process.env.WEBSOCKET_PORT || '3003';
const WS_BASE = `http://127.0.0.1:${WS_PORT}`;

interface EmitPayload {
  conversationId: string;
  event: string;
  data: unknown;
}

/**
 * Emit an event to all sockets currently joined to a conversation room.
 * Best-effort: if WS service is down, the event is silently dropped
 * (clients will re-fetch on next poll / reconnect).
 */
export async function emitToConversation(
  conversationId: string,
  event: string,
  data: unknown
): Promise<void> {
  try {
    const payload: EmitPayload = { conversationId, event, data };
    await fetch(`${WS_BASE}/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': WEBSOCKET_BRIDGE_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    // Non-blocking: WS service may not be running in dev
    console.warn('[ws-emit] failed:', err instanceof Error ? err.message : 'unknown');
  }
}

/**
 * Emit a global event to all connected sockets (e.g., presence updates).
 */
export async function emitGlobal(event: string, data: unknown): Promise<void> {
  try {
    await fetch(`${WS_BASE}/emit-global`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': WEBSOCKET_BRIDGE_TOKEN,
      },
      body: JSON.stringify({ event, data }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.warn('[ws-emit-global] failed:', err instanceof Error ? err.message : 'unknown');
  }
}
