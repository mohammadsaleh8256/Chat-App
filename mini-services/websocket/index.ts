/**
 * Chatgram - WebSocket mini-service
 * ----------------------------------
 * Handles real-time messaging, typing indicators, presence.
 *
 * Authentication: clients send `auth` event with session cookie value.
 * The service verifies the session against the DB and joins rooms.
 *
 * HTTP bridge: Next.js API routes POST to /emit (or /emit-global)
 * to broadcast events to connected clients. This is needed because
 * the API routes run in the Next.js process, not here.
 */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3003', 10);
const BRIDGE_TOKEN = process.env.WEBSOCKET_BRIDGE_TOKEN || 'dev-bridge-token-change-me';

const db = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});

// ====== HTTP server with /emit bridge endpoint ======
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && (req.url === '/emit' || req.url === '/emit-global')) {
    // Verify bridge token
    const token = req.headers['x-bridge-token'];
    if (token !== BRIDGE_TOKEN) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'forbidden' }));
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    try {
      const payload = JSON.parse(body);
      if (req.url === '/emit') {
        io.to(`conv:${payload.conversationId}`).emit(payload.event, payload.data);
      } else {
        io.emit(payload.event, payload.data);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid payload' }));
    }
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime(), connections: io.sockets.sockets.size }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

// ====== Socket.io server ======
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

interface AuthPayload {
  token: string;
}

interface ClientInfo {
  userId: string;
  phone: string;
  fullName: string;
}

const onlineUsers = new Map<string, Set<Socket>>();

io.use(async (socket, next) => {
  try {
    const auth = socket.handshake.auth as AuthPayload;
    if (!auth?.token) {
      return next(new Error('NO_TOKEN'));
    }
    const session = await db.session.findUnique({
      where: { token: auth.token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return next(new Error('INVALID_SESSION'));
    }
    const info: ClientInfo = {
      userId: session.user.id,
      phone: session.user.phone,
      fullName: `${session.user.firstName} ${session.user.lastName}`,
    };
    (socket.data as { user: ClientInfo }).user = info;
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error('AUTH_ERROR'));
  }
});

io.on('connection', (socket) => {
  const user = (socket.data as { user: ClientInfo }).user;
  console.log(`[ws] ${user.fullName} (${user.phone}) connected`);

  // Track online
  if (!onlineUsers.has(user.userId)) onlineUsers.set(user.userId, new Set());
  onlineUsers.get(user.userId)!.add(socket);

  // Mark online in DB
  db.userPresence.upsert({
    where: { userId: user.userId },
    create: { userId: user.userId, isOnline: true, socketId: socket.id },
    update: { isOnline: true, socketId: socket.id },
  }).catch(() => {});

  // Notify others
  io.emit('user:online', { userId: user.userId, isOnline: true });

  socket.on('conversation:join', async ({ conversationId }: { conversationId: string }) => {
    // Verify membership
    const myPart = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.userId } },
    }).catch(() => null);
    if (!myPart) {
      socket.emit('error', { message: 'FORBIDDEN' });
      return;
    }
    socket.join(`conv:${conversationId}`);
  });

  socket.on('conversation:leave', ({ conversationId }: { conversationId: string }) => {
    socket.leave(`conv:${conversationId}`);
  });

  socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
    socket.to(`conv:${conversationId}`).emit('typing:start', {
      conversationId,
      userId: user.userId,
    });
  });

  socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
    socket.to(`conv:${conversationId}`).emit('typing:stop', {
      conversationId,
      userId: user.userId,
    });
  });

  socket.on('message:read', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
    // Persist receipt via DB
    db.messageReceipt.upsert({
      where: { messageId_userId: { messageId, userId: user.userId } },
      create: { messageId, userId: user.userId, status: 'READ' },
      update: { status: 'READ' },
    }).catch(() => {});
    socket.to(`conv:${conversationId}`).emit('message:read', {
      messageId,
      conversationId,
      userId: user.userId,
      status: 'READ',
    });
  });

  socket.on('disconnect', () => {
    const set = onlineUsers.get(user.userId);
    if (set) {
      set.delete(socket);
      if (set.size === 0) {
        onlineUsers.delete(user.userId);
        // Update DB
        db.userPresence.update({
          where: { userId: user.userId },
          data: { isOnline: false, lastSeenAt: new Date(), socketId: null },
        }).catch(() => {});
        // Notify
        io.emit('user:offline', { userId: user.userId, isOnline: false, lastSeenAt: new Date().toISOString() });
      }
    }
    console.log(`[ws] ${user.fullName} disconnected`);
  });

  socket.on('error', (err: unknown) => {
    console.error(`[ws] socket error for ${user.phone}:`, err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[ws] WebSocket server listening on :${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[ws] SIGTERM, shutting down');
  io.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[ws] SIGINT, shutting down');
  io.close(() => process.exit(0));
});
