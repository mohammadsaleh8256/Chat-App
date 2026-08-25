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

### راه سریع (توصیه شده) — اجرای اسکریپت خودکار

بعد از clone کردن repository:

**Windows (CMD یا PowerShell):**
```cmd
setup.bat
```

**Linux / macOS:**
```bash
chmod +x setup.sh
./setup.sh
```

اسکریپت به‌طور خودکار:
1. dependencies اصلی و mini-service را نصب می‌کند
2. Prisma Client را برای mini-service تولید می‌کند
3. فایل `.env` را از `.env.example` می‌سازد
4. دیتابیس را ایجاد و ادمین اولیه را seed می‌کند

> ⚠️ بعد از اجرای setup، فایل `.env` را باز کنید و `STORAGE_DIR` را به مسیر absolute پروژه خودتان تنظیم کنید (مثال: `C:/Users/MS/Documents/MyProjects/Chat-App/storage`).

---

### راه دستی (گام‌به‌گام)

#### 1. نصب dependencies

اگر [Bun](https://bun.sh) نصب دارید (توصیه شده):
```bash
bun install
cd mini-services/websocket
bun install
cd ../..
```

اگر فقط Node.js دارید:
```bash
npm install
cd mini-services/websocket
npm install
cd ../..
```

#### 2. تولید Prisma Client (بسیار مهم)

این مرحله برای هر دو Next.js و mini-service الزامی است. mini-service از Prisma Client ریشه پروژه استفاده می‌کند (نه یک کپی محلی):

```bash
# در ریشه پروژه:
npx prisma generate
# یا: bunx prisma generate
```

> ⚠️ اگر این مرحله را انجام ندهید، mini-service هنگام اجرا خطای `@prisma/client did not initialize yet` می‌دهد.

#### 3. پیکربندی محیط

```bash
cp .env.example .env
```

سپس فایل `.env` را باز کنید و این مقادیر را تنظیم کنید:
- `JWT_SECRET`: یک رشته تصادفی طولانی (≥32 کاراکتر)
- `INITIAL_ADMIN_PHONE`: شماره موبایل مدیر اولیه (مثال: `09123456789`)
- `INITIAL_ADMIN_PASSWORD`: رمز عبور مدیر
- `STORAGE_DIR`: مسیر absolute پوشه storage (در پروژه خودتان)
  - Windows: `C:/Users/MS/Documents/MyProjects/Chat-App/storage`
  - Linux: `/home/user/Chat-App/storage`
  - macOS: `/Users/user/Chat-App/storage`
  - **از `/` در مسیرها استفاده کنید، حتی در Windows** (Prisma و Node آن را به‌درستی handle می‌کنند)

#### 4. راه‌اندازی دیتابیس

```bash
# اعمال schema به SQLite
bun run db:push      # یا: npx prisma db push --accept-data-loss

# ایجاد ادمین اولیه از env vars
bun scripts/seed.js  # یا: node scripts/seed.js
```

#### 5. اجرا در محیط Development

شما به **دو ترمینال** نیاز دارید:

**ترمینال 1 — Next.js app:**
```bash
bun run dev          # یا: npm run dev
```
از `http://localhost:3000` بازدید کنید.

**ترمینال 2 — WebSocket mini-service:**
```bash
cd mini-services/websocket
bun run dev          # یا: npm run dev
```
این سرویس روی `http://localhost:3003` اجرا می‌شود.

> 💡 اگر `bun` ندارید، mini-service به‌صورت خودکار از `tsx` استفاده می‌کند (نیازی به نصب جداگانه نیست).

#### 6. Production Build

```bash
bun run build
bun run start       # یا: npm run start
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

---

## 🔧 Troubleshooting

### 1. خطای `@prisma/client did not initialize yet`

**علت اصلی:** Prisma Client در ریشه پروژه (`Chat-App/node_modules/.prisma/client/`) تولید نشده است. mini-service از Prisma Client ریشه پروژه استفاده می‌کند (نه یک کپی محلی).

**راه‌حل نهایی:**
```bash
# در ریشه پروژه (نه mini-service):
cd C:\Users\MS\Documents\MyProjects\Chat-App

# تولید Prisma Client
npx prisma generate
# یا: bunx prisma generate

# حالا mini-service را اجرا کنید:
cd mini-services\websocket
npm run dev
```

**چرا این مشکل پیش می‌آید؟**
- mini-service یک stub `@prisma/client` در `node_modules` خودش دارد که فقط برای TypeScript types است.
- در runtime، mini-service به‌جای stub محلی، Prisma Client واقعی را از `../../node_modules/@prisma/client` (ریشه پروژه) load می‌کند.
- اگر Prisma Client ریشه تولید نشده باشد، خطا می‌دهد.

**بررسی اینکه آیا کلاینت ریشه تولید شده:**
```bash
# در ریشه پروژه:
dir node_modules\.prisma\client\index.js
# اگر فایل index.js وجود داشت و حجمش >10KB بود، کلاینت تولید شده.
```

**اسکریپت `check-prisma` به‌طور خودکار این را قبل از اجرای dev بررسی می‌کند:**
```bash
cd mini-services\websocket
npm run check-prisma
```

### 2. خطای `bun: command not found` یا `bun --hot` کار نمی‌کند

**علت:** Bun نصب نیست. (در Windows رایج است.)

**راه‌حل:** `package.json` mini-service به‌صورت خودکار از `tsx` به‌عنوان جایگزین استفاده می‌کند. کافیست اجرا کنید:
```bash
npm run dev
# یا: npx tsx watch index.ts
```

برای نصب Bun: https://bun.sh

### 3. خطای `Cannot find module 'dotenv'` در mini-service

**راه‌حل:**
```bash
cd mini-services/websocket
npm install dotenv
# یا: bun add dotenv
```

### 4. خطای `DATABASE_URL` not found در mini-service

**علت:** فایل `.env` در ریشه پروژه وجود ندارد یا `DATABASE_URL` در آن ست نشده.

**راه‌حل:**
1. مطمئن شوید فایل `.env` در ریشه پروژه (کنار `package.json`) وجود دارد.
2. مطمئن شوید این خط در `.env` وجود دارد:
   ```
   DATABASE_URL="file:./dev.db"
   ```
3. mini-service به‌طور خودکار `.env` ریشه پروژه را می‌خواند.

### 5. خطای `EADDRINUSE: address already in use :::3003`

**علت:** پورت 3003 در حال استفاده است (احتمالاً سرویس قبلی هنوز در حال اجراست).

**راه‌حل (Windows):**
```cmd
netstat -ano | findstr :3003
taskkill /PID <PID> /F
```

**راه‌حل (Linux/macOS):**
```bash
lsof -ti:3003 | xargs kill -9
```

### 6. خطای `PrismaClientInitializationError: Database doesn't exist`

**راه‌حل:**
```bash
bun run db:push      # یا: npx prisma db push --accept-data-loss
```

### 7. خطای `Cannot find module '@/lib/db'` یا مشابه در Next.js

**علت:** TypeScript path aliases کار نمی‌کنند.

**راه‌حل:**
```bash
bun run db:generate   # یا: npx prisma generate
```

### 8. مشکل در آپلود فایل یا "Storage directory not found"

**علت:** `STORAGE_DIR` در `.env` اشتباه است یا پوشه وجود ندارد.

**راه‌حل:**
1. در `.env` مقدار `STORAGE_DIR` را به مسیر absolute پروژه خودتان تنظیم کنید:
   - Windows: `STORAGE_DIR="C:/Users/MS/Documents/MyProjects/Chat-App/storage"`
   - Linux: `STORAGE_DIR="/home/user/Chat-App/storage"`
2. اگر مسیر relative می‌خواهید، از `./storage` استفاده کنید (به‌طور خودکار به‌نسبت project root حل می‌شود).
3. پوشه به‌صورت خودکار در اولین آپلود ساخته می‌شود.

### 9. WebSocket نمی‌تواند وصل شود (banner "در حال اتصال مجدد...")

**علت‌های ممکن:**
1. mini-service در حال اجرا نیست → `cd mini-services/websocket && npm run dev`
2. پورت اشتباه است → در `.env` مطمئن شوید `WEBSOCKET_PORT=3003` و `NEXT_PUBLIC_WS_PORT=3003`
3. فایروال یا آنتی‌ویروس پورت 3003 را مسدود می‌کند

**تست اتصال:**
```bash
curl http://localhost:3003/health
# باید برگرداند: {"ok":true,"uptime":...,"connections":0}
```

### 10. مشکل در Windows: مسیرهای فایل با `\` به جای `/`

همیشه از `/` در مسیرها استفاده کنید، حتی در Windows:
- ❌ `C:\Users\MS\...\storage`
- ✅ `C:/Users/MS/.../storage`

Node.js و Prisma به‌طور خودکار `/` را handle می‌کنند. `\` می‌تواند به‌عنوان escape character تفسیر شود.

### 11. خطای `ECONNREFUSED` هنگام fetch از client

اگر در مرورگر ارور `net::ERR_CONNECTION_REFUSED` می‌بینید:
1. مطمئن شوید Next.js در حال اجراست: `curl http://localhost:3000`
2. مطمئن شوید mini-service در حال اجراست: `curl http://localhost:3003/health`
3. اگر هر دو بالا هستند، proxy ممکن است مشکل داشته باشد — سیستم را restart کنید.

### 12. مشکل در نصب dependencies با npm روی Windows

اگر `npm install` خطای permission داد:
1. CMD را به‌صورت **Administrator** باز کنید
2. یا از PowerShell استفاده کنید:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   npm install
   ```

### 13. خطای `Port 3000 is already in use` برای Next.js

**راه‌حل (Windows):**
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

سپس دوباره `npm run dev` را اجرا کنید.

### 14. چک‌لیست نهایی قبل از گزارش مشکل

قبل از گزارش مشکل، این موارد را چک کنید:
- [ ] Node.js نسخه 18+ نصب است (`node --version`)
- [ ] Bun (اختیاری) نصب است (`bun --version`)
- [ ] فایل `.env` در ریشه پروژه وجود دارد و `DATABASE_URL` در آن ست شده
- [ ] `STORAGE_DIR` به مسیر absolute صحیح پروژه شما تنظیم شده
- [ ] هر دو سرویس در حال اجرا هستند:
  - Next.js روی پورت 3000
  - WebSocket روی پورت 3003
- [ ] `curl http://localhost:3000` پاسخ می‌دهد
- [ ] `curl http://localhost:3003/health` پاسخ می‌دهد
- [ ] دیتابیس ساخته شده: `bun run db:push` اجرا شده
- [ ] Prisma Client تولید شده در ریشه: `npx prisma generate` (در ریشه پروژه، نه mini-service)
- [ ] ادمین seed شده: `bun scripts/seed.js` اجرا شده

