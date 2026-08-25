/**
 * Shared bridge token between Next.js API routes and the WS mini-service.
 * In production, this should be set via environment variable.
 */
export const WEBSOCKET_BRIDGE_TOKEN =
  process.env.WEBSOCKET_BRIDGE_TOKEN || 'dev-bridge-token-change-me';
