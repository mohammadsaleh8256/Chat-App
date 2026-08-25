# ChatApp — پیام‌رسان واقعی بر پایه .NET

یک پیام‌رسان **Production-Ready، سریع، امن، PWA** که کاملاً با اکوسیستم .NET ساخته شده است. الهام‌گرفته از تجربه کاربری WhatsApp ولی بدون کپی‌برداری از کد، لوگو یا طراحی اختصاصی آن.

> **Stack:** .NET 9 ASP.NET Core • Blazor Web App (Interactive Server) • EF Core • SQLite • SignalR • JWT • PWA
> **بدون Node.js** — اجرای کامل پروژه فقط با `dotnet` SDK.

## 📐 معماری

```
┌──────────────────────────────────────┐
│  Blazor Web App (Interactive Server)  │
│   Razor Components • SSR + Interactive │
│   RTL Persian UI • PWA • Dark Mode    │
└─────────────────┬────────────────────┘
                  │
        ASP.NET Core Application
                  │
        ┌─────────┴──────────┐
        │                    │
      REST API            SignalR
        │                    │
        └─────────┬──────────┘
                  │
            Application Layer
                  │
            Domain Layer (Entities)
                  │
            Infrastructure (EF Core)
                  │
                SQLite
```

### لایه‌بندی (Clean Architecture)

| پروژه | نقش |
|-------|-----|
| `ChatApp.Domain` | Entities، Enums، ValueObjects، Domain Exceptions |
| `ChatApp.Application` | اینترفیس‌های سرویس، Contracts، DTOها |
| `ChatApp.Infrastructure` | پیاده‌سازی EF Core، SignalR، Storage، Identity |
| `ChatApp.Web` | Blazor UI، API Controllers، Program.cs |
| `ChatApp.Contracts` | Request/Response DTOها (مشترک) |

## 🔐 تصمیمات معماری مهم

### 1. Interactive Server به‌جای Interactive Auto
برای یک Messenger امن، **Interactive Server** انتخاب شد زیرا:
- تمام Business Logic روی سرور باقی می‌ماند (داده‌های حساس به کلاینت leak نمی‌شوند)
- احراز هویت متمرکز است
- نیازی به دانلود WASM bundle بزرگ نیست
- برای real-time messaging با SignalR یکپارچه است

### 2. احراز هویت JWT + Refresh Token
- Access Token کوتاه‌مدت (۱۵ دقیقه)
- Refresh Token طولانی‌مدت (۳۰ روز) با Hash در دیتابیس
- Token Rotation + Revocation
- نقشه‌برداری JWT jti به Refresh Token برای امنیت اضافی

### 3. شماره تلفن به‌عنوان Username
- نرمال‌سازی شماره‌های ایرانی به فرمت E.164 (`+989162744975`)
- `09162744975` و `+989162744975` هر دو به فرمت استاندارد تبدیل می‌شوند
- Hash ذخیره‌سازی برای جستجوی سریع

### 4. آپلود فایل Chunked و Resumable
- تقسیم فایل به قطعات ۴ مگابایتی
- ذخیره قطعات جداگانه با شماره
- امکان Resume پس از قطع
- Retry خودکار با exponential backoff
- Cancel پذیر
- Progress در لحظه
- تأیید完整性 با SHA-256 hash
- بدون محدودیت مصنوعی اندازه

### 5. Presence Multi-Device
- کاربر تا زمانی که حداقل یک Connection فعال باشد، Online است
- ConnectionIdها در `ConcurrentDictionary` نگهداری می‌شوند

## 🚀 نصب و اجرا

### پیش‌نیازها
- .NET 9 SDK ([dot.net](https://dot.net))
- SQLite (به‌صورت خودکار با EF Core ساخته می‌شود)

### اجرای Development

```bash
cd src/ChatApp.Web
dotnet run
```

برنامه روی `https://localhost:5001` و `http://localhost:5000` اجرا می‌شود.

### اجرای Production

```bash
cd src/ChatApp.Web
dotnet publish -c Release -o ./publish
cd ./publish
ASPNETCORE_ENVIRONMENT=Production dotnet ChatApp.Web.dll
```

## ⚙️ تنظیمات

### Environment Variables

| متغیر | پیش‌فرض | توضیح |
|------|--------|-------|
| `INITIAL_ADMIN_PHONE` | `09162744975` | شماره‌ای که در زمان ثبت‌نام، نقش Admin می‌گیرد |
| `CHATAPP_Database__Path` | `Data/chatapp.db` | مسیر فایل SQLite |
| `CHATAPP_Jwt__Secret` | (default dev) | کلید امضای JWT (در Production حتماً تغییر دهید) |
| `CHATAPP_Jwt__AccessTokenMinutes` | `15` | مدت اعتبار Access Token |
| `CHATAPP_Jwt__RefreshTokenDays` | `30` | مدت اعتبار Refresh Token |
| `CHATAPP_FileStorage__Root` | `uploads/` | مسیر ذخیره فایل‌ها |

### اولین Admin
- با شماره `09162744975` (یا شماره تنظیم‌شده در `INITIAL_ADMIN_PHONE`) ثبت‌نام کنید
- به‌صورت خودکار نقش Admin دریافت می‌کنید
- می‌توانید شماره Admin را از پنل ادمین به‌روزرسانی کنید

## 📚 API Endpoints

### Auth
- `POST /api/auth/register` — ثبت‌نام
- `POST /api/auth/login` — ورود
- `POST /api/auth/logout` — خروج
- `POST /api/auth/refresh` — تمدید توکن
- `GET /api/auth/me` — کاربر فعلی

### Users
- `GET /api/users` — لیست کاربران (با Search)
- `GET /api/users/online` — کاربران آنلاین
- `GET /api/users/{id}` — جزئیات کاربر
- `GET /api/users/me` — پروفایل من
- `PUT /api/users/me` — ویرایش پروفایل
- `POST /api/users/me/presence` — به‌روزرسانی وضعیت حضور

### Conversations
- `GET /api/conversations` — لیست گفتگوها
- `POST /api/conversations` — ایجاد گفتگو
- `GET /api/conversations/{id}` — جزئیات گفتگو
- `POST /api/conversations/{id}/read` — علامت‌گذاری خوانده‌شده

### Messages
- `GET /api/conversations/{id}/messages` — لیست پیام‌ها (Pagination)
- `GET /api/conversations/{id}/messages/before/{date}` — پیام‌های قدیمی‌تر
- `POST /api/conversations/{id}/messages` — ارسال پیام
- `DELETE /api/messages/{id}` — حذف پیام
- `POST /api/messages/{id}/read` — علامت خوانده‌شده
- `POST /api/messages/{id}/forward/{convId}` — فوروارد

### Files
- `POST /api/files/init` — شروع آپلود
- `POST /api/files/{id}/chunk/{index}` — آپلود قطعه
- `POST /api/files/{id}/complete` — تکمیل آپلود
- `POST /api/files/{id}/cancel` — لغو
- `GET /api/files/{id}/status` — وضعیت آپلود
- `GET /api/files/{id}` — دانلود

### Admin (نیازمند نقش Admin)
- `GET /api/admin/dashboard` — آمار داشبورد
- `GET /api/admin/users` — لیست کاربران
- `PUT /api/admin/users/{id}/role` — تغییر نقش
- `PUT /api/admin/users/{id}/status` — تغییر وضعیت
- `GET /api/admin/users/{id}/conversations` — گفتگوهای کاربر
- `GET /api/admin/conversations/{id}/messages` — پیام‌های گفتگو
- `GET /api/admin/messages/search` — جستجوی پیام
- `GET /api/admin/audit-logs` — لاگ‌های ممیزی
- `GET /api/admin/settings/admin-phone` — شماره Admin
- `PUT /api/admin/settings/admin-phone` — به‌روزرسانی شماره Admin

### SignalR Hub
- `/hubs/chat` — Hub اصلی چت
- Events: `ReceiveMessage`, `MessageDelivered`, `MessageRead`, `MessageDeleted`, `UserTyping`, `UserStoppedTyping`, `UserOnline`, `UserOffline`, `ConversationUpdated`

## 🔒 امنیت

- ✅ ASP.NET Core Identity-compatible Password Hashing (BCrypt)
- ✅ JWT با امضای HMAC-SHA256
- ✅ Refresh Token Rotation و Revocation
- ✅ Authorization Policies (User، Admin)
- ✅ Input Validation (FluentValidation)
- ✅ Rate Limiting (200 req/10s per IP)
- ✅ CORS Policy محدود
- ✅ IDOR Protection (بررسی عضویت در گفتگو)
- ✅ Path Traversal Protection در File Storage
- ✅ Secure Cookies (HttpOnly)
- ✅ Audit Logs برای تمام عملیات Admin
- ✅ Soft Delete (حذف فیزیکی انجام نمی‌شود)
- ✅ AsNoTracking برای کوئری‌های فقط خواندنی

## 📊 عملکرد

- Pagination برای تمام لیست‌ها
- Cursor Pagination برای پیام‌ها (Infinite Scroll)
- Indexهای مناسب روی تمام فیلدهای جستجو
- Virtualization برای لیست‌های طولانی
- Streaming آپلود فایل (نه بارگذاری کامل در RAM)
- AsNoTracking برای کوئری‌های خواندنی
- ConcurrentDictionary برای Presence (lock-free)

## 🎨 UI Features

- ✅ کاملاً RTL با فونت فارسی Vazirmatn
- ✅ Dark Mode (Light/Dark/System)
- ✅ Responsive (Mobile/Desktop)
- ✅ Typing Indicator
- ✅ Online/Offline Status
- ✅ Last Seen
- ✅ Message Status (Sending/Sent/Delivered/Read/Failed)
- ✅ Avatar با Initials fallback
- ✅ Infinite Scroll برای پیام‌ها
- ✅ Toast Notifications
- ✅ PWA (Installable + Offline)
- ✅ Push Notifications

## 🛡️ Admin Panel

- ✅ Dashboard با آمار کامل
- ✅ مدیریت کاربران (Search، تغییر نقش، فعال/غیرفعال)
- ✅ مشاهده گفتگوهای هر کاربر
- ✅ مشاهده پیام‌های هر گفتگو
- ✅ جستجوی پیام در سراسر سیستم
- ✅ لاگ‌های ممیزی با فیلتر زمان
- ✅ تنظیمات سیستم (شماره Admin)
- ❌ Admin نمی‌تواند به‌جای کاربر پیام بفرستد (در نسخه اول)

## 🧪 Testing

پروژه تست‌ها آماده‌سازی شده‌اند:
- `ChatApp.UnitTests` — تست‌های واحد
- `ChatApp.IntegrationTests` — تست‌های یکپارچه‌سازی
- `ChatApp.ApiTests` — تست‌های API

## 📝 Migration

Migration به‌صورت خودکار در زمان استارت برنامه اعمال می‌شود (`db.Database.Migrate()`).

دستی:
```bash
cd src/ChatApp.Web
dotnet ef migrations add MigrationName --project ../ChatApp.Infrastructure --startup-project . --context ChatAppDbContext --output-dir Migrations
dotnet ef database update --project ../ChatApp.Infrastructure --startup-project .
```

## 📦 ساختار پروژه

```
ChatApp.sln
src/
├── ChatApp.Web/                  # Blazor + API + Program.cs
│   ├── Api/Controllers/
│   ├── Components/
│   │   ├── Layout/
│   │   ├── Pages/
│   │   │   └── Admin/
│   │   ├── Chat/
│   │   └── Shared/
│   ├── Services/
│   ├── wwwroot/
│   │   ├── css/
│   │   ├── js/
│   │   └── manifest.webmanifest
│   ├── Program.cs
│   └── appsettings.json
├── ChatApp.Application/          # اینترفیس‌ها
│   └── Interfaces/
├── ChatApp.Domain/               # Entities, Enums, ValueObjects
│   ├── Entities/
│   ├── Enums/
│   ├── ValueObjects/
│   └── Exceptions/
├── ChatApp.Infrastructure/       # پیاده‌سازی
│   ├── Authentication/
│   ├── Identity/
│   ├── Mapping/
│   ├── Persistence/
│   │   └── Migrations/
│   ├── Services/
│   ├── SignalR/
│   └── Storage/
└── ChatApp.Contracts/            # DTOها
    ├── Common/
    ├── Dtos/
    ├── Requests/
    └── Responses/
```

## 🎯 نکات طراحی

- **Performance-First**: تمام کوئری‌ها `AsNoTracking` و Paginated هستند
- **Security-First**: هر Endpoint دارای Authorization است
- **Mobile-First**: UI کاملاً Responsive با Back Button
- **Accessibility**: semantic HTML و کنتراست رنگ مناسب
- **Maintainability**: Clean Architecture با جداسازی واضح لایه‌ها
- **Extensibility**: سرویس‌ها به‌صورت Interface تعریف شده‌اند (قابل تعویض با S3، Azure Blob و غیره)

## 📄 لایسنس

این پروژه به‌عنوان نمونه‌ی پیاده‌سازی یک Messenger کامل .NET ارائه می‌شود.

## 🤝 مشارکت

PR و Issue welcome!

---

ساخته‌شده با ❤️ و .NET 9
