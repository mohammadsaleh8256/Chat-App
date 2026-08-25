# چت‌گرام | Chatgram Messenger

یک پیام‌رسان کامل، سریع، امن و واکنش‌گرا با Next.js که از نظر تجربه کاربری الهام‌گرفته از WhatsApp است اما طراحی و کد کاملاً مستقل است.

## ✨ ویژگی‌ها

- **احراز هویت با شماره موبایل** — ثبت‌نام و ورود با شماره موبایل ایرانی، password hashing با bcrypt، session-based authentication
- **پیام‌رسانی Real-time** — WebSocket با socket.io برای پیام‌های زنده، typing indicator، read receipts، presence (آنلاین/آفلاین)
- **ارسال فایل Chunked و Resumable** — آپلود فایل‌های بزرگ با chunks، ادامه آپلود قطع‌شده، نمایش progress، لغو آپلود، preview تصاویر ویدیو و صدا، download امن
- **پنل مدیریت کامل** — داشبورد، مدیریت کاربران، مشاهده گفتگوها و پیام‌ها (با Audit Log خودکار)، تنظیمات قابل تغییر از جمله شماره مدیر
- **Audit Log شفاف** — تمام مشاهده‌های ادمین از گفتگوها و فایل‌ها در دیتابیس ثبت می‌شود
- **RTL و فارسی** — فونت Vazirmatn، اعداد فارسی، تاریخ شمسی
- **Responsive** — Mobile-first، Desktop: لیست گفتگوها + چت؛ Mobile: لیست گفتگوها سپس چت Full Screen
- **PWA** — Manifest، Service Worker، نصب‌پذیر، Offline awareness
- **Dark Mode** — پشتیبانی از تم تیره

## 🛠 Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide, Zustand, TanStack Query
- **Backend**: Next.js API Routes (Server-side), Prisma ORM, SQLite
- **Real-time**: Socket.io (mini-service روی port جدا)
- **Security**: bcrypt password hashing, httpOnly session cookies, secure download authorization, audit logging
- **Storage**: SQLite (metadata) + Disk (file chunks)
- **Font**: Vazirmatn (RTL + Latin)

## 📁 Architecture

```
src/
  app/
    api/                  # REST API routes
      auth/{register,login,logout,me,ws-token}/
      users/
      conversations/[id]/messages/
      messages/[id]/
      files/{init,chunk,complete,[id]}/
      admin/{users,conversations,audit-logs,stats,settings}/
      presence/
    layout.tsx            # Root layout (RTL + Vazirmatn + ThemeProvider)
    page.tsx              # Empty (everything in AppShell)
    globals.css           # Design system + RTL + theme
  components/
    app-shell.tsx         # Client-side router (hash-based)
    ui/                   # shadcn/ui components
  features/
    auth/auth-screen.tsx  # Login + Register
    chat/                 # ConversationList, ChatWindow, MessageBubble, MessageInput
    admin/admin-screen.tsx  # Admin panel (dashboard, users, conversations, audit, settings)
  hooks/use-socket.ts     # WebSocket client
  lib/
    db.ts                 # Prisma client
    api.ts                # Fetch wrapper, formatters, helpers
    router.ts             # Client-side hash router
    serializers.ts        # DB -> JSON transforms
    api-helpers.ts        # withErrorHandler, parseOrThrow
  server/
    auth/                 # password, session, validation
    storage/              # chunked file storage
    audit/                # audit log recorder
    websocket/            # emit bridge (HTTP bridge to WS service)
  store/                  # Zustand stores (auth, chat)
  types/index.ts          # Shared types

mini-services/
  websocket/              # Standalone socket.io server (port 3003)
    index.ts
    package.json

prisma/
  schema.prisma           # Full schema: User, Session, Conversation, Message, Attachment, Receipt, AuditLog, AdminSetting, UserPresence
scripts/
  seed.js                # Initial admin from INITIAL_ADMIN_PHONE env var
public/
  manifest.json          # PWA manifest
  sw.js                  # Service worker
  icon-192.png, icon-512.png
```

## 🚀 Setup

### 1. نصب dependencies

```bash
bun install
cd mini-services/websocket && bun install && cd ..
```

### 2. پیکربندی محیط

```bash
cp .env.example .env
# سپس مقادیر را در .env قرار دهید (JWT_SECRET، INITIAL_ADMIN_PHONE، و غیره)
```

### 3. راه‌اندازی دیتابیس

```bash
bun run db:push      # اعمال schema به SQLite
bun run db:generate  # تولید Prisma Client
bun scripts/seed.js  # ایجاد ادمین اولیه از env
```

### 4. اجرا در محیط Development

```bash
# ترمینال 1: Next.js
bun run dev

# ترمینال 2: WebSocket service
cd mini-services/websocket && bun run dev
```

سپس به `http://localhost:3000` بروید.

### 5. Production Build

```bash
bun run build
bun run start
```

## 🔐 احراز هویت

- شماره موبایل به‌عنوان Username اصلی کاربر استفاده می‌شود (unique و normalized)
- رمز عبور با bcrypt (10 rounds) هش می‌شود
- Session token به‌صورت httpOnly cookie نگهداری می‌شود (TTL: 30 روز)
- هیچ token در localStorage ذخیره نمی‌شود

## 📦 آپلود فایل

- فایل به chunks 1MB تقسیم می‌شود
- هر chunk جداگانه آپلود می‌شود (نه کل فایل در RAM)
- API: `/api/files/init` → `/api/files/chunk` (تکرار) → `/api/files/complete`
- Resume: با GET `/api/files/chunk?uploadId=...` لیست chunks دریافتی قابل دریافت است
- Cancel: DELETE `/api/files/[id]?uploadId=...`
- Secure download: احراز هویت الزامی است؛ فقط uploader، recipient، یا admin می‌توانند دانلود کنند
- Database فقط metadata فایل را نگه می‌دارد

## 🛡 پنل مدیریت و Audit

دسترسی از طریق منوی کاربر → پنل مدیریت (فقط مدیران).

امکانات:
- داشبورد با آمار کلی
- لیست کاربران
- لیست گفتگوها با تعداد پیام
- مشاهده پیام‌های هر گفتگو (با تصاویر و فایل‌ها)
- تنظیمات از جمله تغییر شماره مدیر اولیه
- لاگ‌های ممیزی: هر بار که ادمین گفتگو، پیام یا فایلی را مشاهده می‌کند، در `AdminAuditLog` ثبت می‌شود

**شماره مدیر اولیه از env var خوانده می‌شود و در database قابل تغییر است (نه در کد).**

## 🔒 امنیت

- هیچ secret در سورس کد نیست
- `.env` در `.gitignore` است
- Session cookie با httpOnly و sameSite=lax
- Authorization برای هر API request بررسی می‌شود
- IDOR prevention: کاربر فقط به گفتگوها و فایل‌های خودش دسترسی دارد
- Rate limiting (در محیط production از طریق Caddy قابل افزودن)

## 🌐 PWA

- `manifest.json` با theme color، icons، start_url
- `sw.js` Service Worker با cache-first برای static assets و network-first برای navigation
- نصب‌پذیر (Standalone mode)
- Offline awareness: هنگام قطع اتصال، banner "در حال اتصال مجدد..." نمایش داده می‌شود

## 📱 Responsive

- **Mobile (<768px)**: فقط لیست گفتگوها یا فقط چت (Full Screen)
- **Desktop (≥768px)**: لیست گفتگوها + چت به‌صورت side-by-side
- تمایل به موبایل (Mobile-first): ابتدا موبایل، سپس enhancements دسکتاپ

## 🎨 طراحی

- رنگ اصلی: Teal (الهام از Telegram، نه WhatsApp)
- فونت: Vazirmatn (فارسی + لاتین)
- Dark mode: پشتیبانی کامل
- Bubble رنگ: out (سبز روشن) / in (خاکستری روشن)
- انیمیشن‌های ظریف با Framer Motion
- Context menu برای پیام‌ها (Reply / Copy / Forward / Delete)

## 📋 Environment Variables

| نام | توضیح | مثال |
|-----|--------|------|
| `DATABASE_URL` | مسیر فایل SQLite | `file:/home/z/my-project/db/messenger.db` |
| `JWT_SECRET` | رشته تصادفی (≥32 char) | `change-this-...` |
| `SESSION_COOKIE_NAME` | نام cookie سشن | `messenger_session` |
| `INITIAL_ADMIN_PHONE` | شماره مدیر اولیه (فقط در seed) | `09162744975` |
| `INITIAL_ADMIN_PASSWORD` | رمز مدیر اولیه | `Admin@12345` |
| `STORAGE_DIR` | مسیر ذخیره فایل‌ها | `/home/z/my-project/storage` |
| `WEBSOCKET_PORT` | پورت سرویس WS | `3003` |
| `NEXT_PUBLIC_APP_NAME` | نام اپ | `Chatgram` |
| `NEXT_PUBLIC_WS_PORT` | پورت WS برای client | `3003` |

## 📜 License

MIT — این پروژه نمونه است و هیچ وابستگی تجاری به WhatsApp ندارد.
