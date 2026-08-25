'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users,
  MessagesSquare,
  HardDrive,
  Shield,
  ArrowRight,
  ScrollText,
  Settings as SettingsIcon,
  Trash2,
  Search,
} from 'lucide-react';
import { api, avatarColor, formatBytes, formatDateTime, formatRelativeTime, getInitials, toPersianDigits } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { toast } from 'sonner';
import type { SafeUser, AuditLogEntry } from '@/types';
import { useAuthStore } from '@/store/auth';

interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalAttachments: number;
  totalStorageBytes: number;
  adminCount: number;
  newUsers24h: number;
  newMessages24h: number;
}

interface AdminConversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  avatarUrl: string | null;
  messageCount: number;
  participants: Array<{ userId: string; name: string; phone: string }>;
  lastMessageAt: string;
  createdAt: string;
}

export function AdminScreen() {
  const { route, push } = useRouter();
  const tab = route.name === 'admin' ? route.tab || 'dashboard' : 'dashboard';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-16 md:w-60 border-l border-border bg-card flex flex-col">
        <div className="p-3 md:p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden md:block">
              <p className="font-semibold text-sm">پنل مدیریت</p>
              <p className="text-xs text-muted-foreground">چت‌گرام</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <AdminNavItem
            active={tab === 'dashboard'}
            icon={<Shield className="w-5 h-5" />}
            label="داشبورد"
            onClick={() => push({ name: 'admin', tab: 'dashboard' })}
          />
          <AdminNavItem
            active={tab === 'users'}
            icon={<Users className="w-5 h-5" />}
            label="کاربران"
            onClick={() => push({ name: 'admin', tab: 'users' })}
          />
          <AdminNavItem
            active={tab === 'conversations'}
            icon={<MessagesSquare className="w-5 h-5" />}
            label="گفتگوها"
            onClick={() => push({ name: 'admin', tab: 'conversations' })}
          />
          <AdminNavItem
            active={tab === 'audit'}
            icon={<ScrollText className="w-5 h-5" />}
            label="لاگ‌های ممیزی"
            onClick={() => push({ name: 'admin', tab: 'audit' })}
          />
          <AdminNavItem
            active={tab === 'settings'}
            icon={<SettingsIcon className="w-5 h-5" />}
            label="تنظیمات"
            onClick={() => push({ name: 'admin', tab: 'settings' })}
          />
        </nav>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => push({ name: 'chat' })}
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            بازگشت به چت
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'conversations' && (
          route.name === 'admin' && route.conversationId
            ? <AdminMessageViewer conversationId={route.conversationId} />
            : <ConversationsTab />
        )}
        {tab === 'audit' && <AuditTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

function AdminNavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ stats: AdminStats }>('/api/admin/stats')
      .then((r) => setStats(r.stats))
      .catch(() => toast.error('خطا در بارگذاری آمار'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'کاربران', value: stats.totalUsers, icon: <Users className="w-5 h-5" />, sub: `+${toPersianDigits(stats.newUsers24h)} امروز` },
    { label: 'گفتگوها', value: stats.totalConversations, icon: <MessagesSquare className="w-5 h-5" /> },
    { label: 'پیام‌ها', value: stats.totalMessages, icon: <MessagesSquare className="w-5 h-5" />, sub: `+${toPersianDigits(stats.newMessages24h)} امروز` },
    { label: 'فایل‌ها', value: stats.totalAttachments, icon: <HardDrive className="w-5 h-5" /> },
    { label: 'حجم ذخیره‌سازی', value: formatBytes(stats.totalStorageBytes), icon: <HardDrive className="w-5 h-5" />, raw: true },
    { label: 'مدیران', value: stats.adminCount, icon: <Shield className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">داشبورد مدیریت</h1>
        <p className="text-sm text-muted-foreground mt-1">نمای کلی از سیستم</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {c.icon}
                </div>
              </div>
              <p className="text-2xl font-bold">
                {c.raw ? c.value : toPersianDigits(c.value)}
              </p>
              {c.sub && <p className="text-xs text-emerald-500 mt-1">{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">یادآوری امنیتی</CardTitle>
          <CardDescription>تمام مشاهده پیام‌ها و فایل‌ها در لاگ ممیزی ثبت می‌شود</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            هر بار که یک گفتگو یا فایل را مشاهده می‌کنید، یک رکورد ممیزی با آدرس IP شما ثبت می‌شود. این رکوردها برای شفافیت و پاسخگویی نگهداری می‌شوند.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api<{ users: SafeUser[] }>('/api/admin/users')
      .then((r) => setUsers(r.users))
      .catch(() => toast.error('خطا در بارگذاری کاربران'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(
    (u) =>
      u.fullName.includes(search) ||
      u.phone.includes(search)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {toPersianDigits(users.length)} کاربر ثبت‌نام شده
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو..."
          className="pr-9"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              کاربری یافت نشد
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-right p-3 font-medium">کاربر</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">شماره</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">آخرین بازدید</th>
                  <th className="text-right p-3 font-medium">نقش</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-9 h-9">
                          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                          <AvatarFallback className={avatarColor(u.id)}>
                            {getInitials(u.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground md:hidden" dir="ltr">{u.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell" dir="ltr">{u.phone}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {formatRelativeTime(u.lastSeenAt)}
                    </td>
                    <td className="p-3">
                      {u.role === 'ADMIN' ? (
                        <Badge className="bg-primary">مدیر</Badge>
                      ) : (
                        <Badge variant="secondary">کاربر</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConversationsTab() {
  const { push } = useRouter();
  const [convs, setConvs] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ conversations: AdminConversation[] }>('/api/admin/conversations')
      .then((r) => setConvs(r.conversations))
      .catch(() => toast.error('خطا در بارگذاری گفتگوها'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">مدیریت گفتگوها</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مشاهده گفتگوها و پیام‌ها (هر مشاهده در لاگ ممیزی ثبت می‌شود)
        </p>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : convs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            گفتگویی وجود ندارد
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {convs.map((c) => (
            <Card key={c.id} className="hover:bg-accent/30 transition-colors cursor-pointer"
              onClick={() => push({ name: 'admin', tab: 'conversations', conversationId: c.id })}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.title} />}
                  <AvatarFallback className={avatarColor(c.id)}>
                    {getInitials(c.title)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.participants.map((p) => p.name).join('، ')}
                  </p>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                  <p>{toPersianDigits(c.messageCount)} پیام</p>
                  <p>{formatRelativeTime(c.lastMessageAt)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminMessageViewer({ conversationId }: { conversationId: string }) {
  const { push } = useRouter();
  const [data, setData] = useState<{ conversation: any; messages: any[]; nextCursor: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ conversation: any; messages: any[]; nextCursor: string | null }>(
      `/api/admin/conversations/${conversationId}?limit=100`
    )
      .then((r) => setData(r))
      .catch(() => toast.error('خطا در بارگذاری پیام‌ها'))
      .finally(() => setLoading(false));
  }, [conversationId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;
  const sorted = [...data.messages].reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => push({ name: 'admin', tab: 'conversations' })}>
            <ArrowRight className="w-4 h-4 ml-1" /> بازگشت
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مشاهده پیام‌ها</CardTitle>
          <CardDescription>
            گفتگو: {data.conversation.title} • {toPersianDigits(data.messages.length)} پیام
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mb-4 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ هر بار که این صفحه را باز می‌کنید، در لاگ ممیزی ثبت می‌شود.
          </div>
          {sorted.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              پیامی وجود ندارد
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {sorted.map((m: any) => (
                <div
                  key={m.id}
                  className={`flex ${m.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.isOwn
                        ? 'bg-[var(--bubble-out)] rounded-bl-md'
                        : 'bg-[var(--bubble-in)] rounded-br-md'
                    }`}
                  >
                    <p className="text-xs font-semibold text-primary mb-1">
                      {m.senderName}
                    </p>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {m.attachments.map((a: any) => (
                          <a
                            key={a.id}
                            href={a.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs underline text-primary"
                          >
                            📎 {a.fileName || 'فایل'} ({formatBytes(a.sizeBytes)})
                          </a>
                        ))}
                      </div>
                    )}
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ logs: AuditLogEntry[] }>('/api/admin/audit-logs?limit=100')
      .then((r) => setLogs(r.logs))
      .catch(() => toast.error('خطا در بارگذاری لاگ‌ها'))
      .finally(() => setLoading(false));
  }, []);

  const actionLabels: Record<string, string> = {
    VIEW_CONVERSATION: 'مشاهده گفتگو',
    VIEW_MESSAGE: 'مشاهده پیام',
    VIEW_ATTACHMENT: 'مشاهده فایل',
    VIEW_USER_LIST: 'مشاهده لیست کاربران',
    UPDATE_ADMIN_PHONE: 'به‌روزرسانی شماره مدیر',
    UPDATE_USER_ROLE: 'تغییر نقش کاربر',
    DELETE_USER: 'حذف کاربر',
    DOWNLOAD_ATTACHMENT: 'دانلود فایل',
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">لاگ‌های ممیزی</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ثبت تمام فعالیت‌های مدیریت
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              لاگی وجود ندارد
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-right p-3 font-medium">عملیات</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">انجام‌دهنده</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">IP</th>
                  <th className="text-right p-3 font-medium">زمان</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="p-3">
                      <Badge variant="secondary">{actionLabels[l.action] || l.action}</Badge>
                    </td>
                    <td className="p-3 hidden md:table-cell">{l.actorName}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground" dir="ltr">
                      {l.ipAddress || '-'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {formatDateTime(l.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { user } = useAuthStore();
  const [adminPhone, setAdminPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const r = await api<{ settings: Array<{ key: string; value: string; updatedAt: string; updatedBy: string | null }> }>(
        '/api/admin/settings'
      );
      const phone = r.settings.find((s) => s.key === 'initial_admin_phone');
      if (phone) setAdminPhone(phone.value);
    } catch {
      toast.error('خطا در بارگذاری تنظیمات');
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await api('/api/admin/settings', { method: 'PATCH', json: { phone: adminPhone } });
      toast.success('شماره مدیر به‌روزرسانی شد');
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات</h1>
        <p className="text-sm text-muted-foreground mt-1">پیکربندی سیستم</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">شماره مدیر اولیه</CardTitle>
          <CardDescription>
            این شماره در database ذخیره شده و قابل تغییر است (نه در کد).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">شماره موبایل مدیر</label>
            <Input
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              dir="ltr"
              className="text-right"
              placeholder="09..."
            />
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
          {user && (
            <p className="text-xs text-muted-foreground">
              کاربر فعلی: {user.fullName} ({user.phone})
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
