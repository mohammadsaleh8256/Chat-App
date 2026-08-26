# ChatApp — Production-Ready Real-Time Messenger

A production-grade messenger inspired by modern chat applications, built with **NestJS + React + TypeScript**.

> **Stack:** NestJS 10 • Prisma 5 + SQLite • Socket.IO • JWT (Access + Refresh Token Rotation) • React 18 + Vite • Tailwind CSS • PWA
> **No Next.js / Bun / Vue / Angular / React Native.**

---

## 📐 Architecture

```
chat-app/
├── backend/        # NestJS REST API + Socket.IO gateway
│   ├── src/
│   │   ├── auth/           # JWT auth, refresh tokens, rotation
│   │   ├── users/          # User search, profile, presence
│   │   ├── conversations/  # Private 1:1 conversations
│   │   ├── messages/       # Messages with reply, forward, delete, read receipts
│   │   ├── files/          # Chunked + resumable file upload, secure download
│   │   ├── admin/          # Admin panel: dashboard, users, audit logs, settings
│   │   ├── common/         # Filters, guards, decorators, gateway
│   │   └── prisma/         # PrismaService + SeedService
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── uploads/             # Local file storage (gitignored)
│
├── frontend/       # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/     # Avatar, ConversationList, ChatWindow, MessageBubble
│   │   ├── layouts/        # AuthLayout, ChatLayout, AdminLayout
│   │   ├── pages/          # Login, Register, Chat, NewChat + admin/*
│   │   ├── services/       # api (axios), socket (Socket.IO), uploader (chunked)
│   │   ├── stores/         # zustand auth store
│   │   └── types/          # TypeScript interfaces
│   └── public/             # icons, manifest, favicon
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (tested with Node 24)
- npm 9+

### 1. Backend

```bash
cd backend
cp .env.example .env       # adjust secrets in production!
npm install
npx prisma generate
npx prisma migrate dev     # creates SQLite DB
npm run start:dev          # http://localhost:3000
```

Swagger UI: http://localhost:3000/api/docs

### 2. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev                 # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to `http://localhost:3000`.

### 3. Initial Admin

Register at http://localhost:5173/register using the phone number configured in `INITIAL_ADMIN_PHONE` (default `09162744975`). You will be automatically granted the `ADMIN` role. The phone number itself is **not** hardcoded in any authorization check — only the role/permission is checked.

---

## 🔐 Authentication

- **Access Token** (JWT, 15 min) — signed with `JWT_ACCESS_SECRET`
- **Refresh Token** (random 48 bytes, 30 days) — stored as SHA-256 hash in DB, never plaintext
- **Rotation** — every `/api/auth/refresh` revokes the old refresh token and issues a new pair
- **Revocation** — `/api/auth/logout` revokes the refresh token; access token expires naturally
- **Multi-device** — each login creates a separate refresh token, so multiple devices stay logged in independently

Socket.IO connections authenticate via `auth: { token }` in the handshake. Invalid tokens are rejected and the socket is disconnected.

---

## 💬 Real-Time (Socket.IO)

Events:
- `conversation:join` / `conversation:leave`
- `message:send` / `message:receive`
- `message:delivered` / `message:read`
- `typing:start` / `typing:stop`
- `user:online` / `user:offline` (only broadcast to members of shared conversations)

Each conversation gets a Socket.IO room `conversation:<id>`. The server enforces membership before letting a client join — a client cannot listen to conversations they are not part of.

---

## 📎 File Upload (Chunked + Resumable)

1. `POST /api/files/upload/init` — start a session, returns `uploadId` + `attachmentId`
2. `POST /api/files/upload/:uploadId/chunk/:index` — upload a single chunk (binary body, max 20MB)
3. `POST /api/files/upload/:uploadId/complete` — merge chunks + verify hash + cleanup
4. `POST /api/files/upload/:uploadId/cancel` — abort + delete received chunks
5. `GET /api/files/:id/status` — check progress / resume a broken upload
6. `GET /api/files/:id` — secure download (uploader OR conversation participant only)

**Features:**
- Stream-based — chunks never fully buffered in RAM
- Resumable — already-received chunks are skipped on retry
- Path-traversal-safe — `LocalFileStorage` resolves every path against `UPLOAD_DIR` and rejects escapes
- MIME + extension validation
- IDOR protection — server checks conversation membership before serving downloads
- File contents are **never** stored in SQLite — only metadata (filename, mime, size, storageKey, messageId)

To swap in S3/MinIO/Azure Blob, implement the `IFileStorage` interface and provide it via the `FILE_STORAGE_TOKEN` DI token.

---

## 🛡️ Admin Panel (`/admin`)

- **Dashboard** — total users, online, conversations, messages, attachments, total storage
- **Users** — search by name + phone, change role/status, view user conversations + messages
- **Conversations & Messages** — search by user ID, view conversations, view messages, search messages globally
- **Audit Logs** — every admin action (view user, view conversation, change role, etc.) is logged with admin + IP
- **Settings** — change `INITIAL_ADMIN_PHONE` without restarting the server

Admin authorization is **server-side only** — `AdminController` checks `user.role === 'ADMIN'` on every endpoint. Admin cannot change their own role/status (self-lockout protection).

---

## 🔒 Security

- ✅ JWT signed with HMAC-SHA256, secret ≥ 32 chars enforced in production
- ✅ Refresh tokens hashed with SHA-256, rotation on refresh
- ✅ bcrypt password hashing (work factor 12)
- ✅ Rate limiting — 200 req / 10s per IP (configurable)
- ✅ Helmet security headers
- ✅ CORS configured via `CORS_ORIGIN` env var
- ✅ IDOR protection — every conversation/file access checks membership
- ✅ Path traversal protection in `LocalFileStorage.resolve()`
- ✅ MIME + extension validation on uploads
- ✅ Input validation with `class-validator` + global `ValidationPipe`
- ✅ Global exception filter normalizes errors and hides stack traces in production
- ✅ Soft-delete for users + messages (data is never hard-deleted)
- ✅ Audit log for every admin "view" of user data

---

## 📦 PWA

The frontend is a fully installable PWA:
- `manifest.webmanifest` with RTL + Persian metadata
- Service Worker via `vite-plugin-pwa` (auto-update)
- Icons (192px + 512px)
- Offline awareness (cached shell + network-first for API)
- Standalone display mode
- Push-ready (notification click handler wired up)

---

## 🧪 Testing

### Backend

```bash
cd backend
npm test                 # unit + integration (Jest)
```

Tests cover:
- AuthService (register, login, refresh, logout)
- Phone normalization (Iranian formats)
- Conversation creation (prevents duplicates)
- Message send, mark-read, delete, forward
- File upload init/chunk/complete/cancel
- Admin endpoints (role check, self-lockout prevention)

### Frontend

```bash
cd frontend
npm run build           # tsc + vite production build
```

Manual QA scenario is documented in section 22 of the original brief.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite connection string |
| `JWT_ACCESS_SECRET` | (none, dev fallback) | HMAC secret for access tokens |
| `JWT_REFRESH_SECRET` | (none, dev fallback) | HMAC secret for refresh tokens |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES` | `30d` | Refresh token lifetime |
| `PORT` | `3000` | HTTP port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `INITIAL_ADMIN_PHONE` | `09162744975` | Phone granted ADMIN on first registration |
| `UPLOAD_DIR` | `./uploads` | Local file storage root |
| `MAX_FILE_SIZE_BYTES` | `10737418240` (10 GB) | Maximum file size |
| `CHUNK_SIZE_BYTES` | `5242880` (5 MB) | Default chunk size hint |

**Production:** set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to random 64+ char strings, set `NODE_ENV=production`, and remove the dev fallback.

---

## 🏗️ Build & Run (Production)

### Backend
```bash
cd backend
npm run build
NODE_ENV=production node dist/main.js
```

### Frontend
```bash
cd frontend
npm run build            # outputs to dist/
# Serve with any static server (nginx, serve, etc.)
npx serve dist -l 5173
```

For production deployment, put a reverse proxy (nginx/Caddy) in front:
- Serve `frontend/dist/` as static files
- Proxy `/api/*` and `/socket.io/*` to the backend

---

## 📝 Database Setup

```bash
cd backend
npx prisma migrate dev --name init    # create + apply migration
npx prisma generate                  # regenerate Prisma Client after schema changes
npx prisma studio                    # inspect data
```

The backend also runs migrations automatically on startup if `SeedService` is configured.

---

## 🚨 Security Notes

- **Never commit** `.env`, `*.db`, `uploads/`, or `secrets.json` (they are gitignored).
- The initial admin phone `09162744975` is configurable via env var and via Admin → Settings. The phone itself is **not** used for authorization — only the user's `role` field is checked.
- Refresh tokens are stored as SHA-256 hashes. Even if the DB is leaked, attackers cannot reuse them.
- All admin "view" actions are audit-logged with IP + timestamp.
- Path traversal attempts in file storage are rejected at the storage layer.

---

## 📦 GitHub Deployment

```bash
git init
git remote add origin https://github.com/<user>/<repo>.git
git add .
git commit -m "feat: production-ready NestJS + React messenger"
git push -u origin main
```

**Never** commit the GitHub token. Use `git` credential manager or `~/.git-credentials` (with `chmod 600`).

---

## 🐛 Known Limitations / Future Work

- Group chat: schema supports it (`isGroup`, `ConversationParticipant`) but UI is 1:1 only.
- Voice/video calls: not implemented (would need WebRTC).
- File thumbnails: generated client-side via `<img>`/`<video>` tags; no server-side image processing.
- Search index: SQLite `LIKE` queries; for large scale, swap in Postgres + trigram/full-text.
- Tests: backend has unit tests; frontend tests (Vitest/Playwright) are a TODO.

---

Built with ❤️ — NestJS + React + TypeScript.
