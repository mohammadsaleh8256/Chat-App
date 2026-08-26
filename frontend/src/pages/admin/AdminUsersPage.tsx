import { useEffect, useState } from 'react';
import api from '../../services/api';
import type { User } from '../../types';
import { Avatar } from '../../components/Avatar';
import { formatPhone, relativeTime } from '../../utils';
import toast from 'react-hot-toast';
import { Search, X } from 'lucide-react';
import type { Conversation, Message } from '../../types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<User | null>(null);
  const [userConversations, setUserConversations] = useState<Conversation[] | null>(null);
  const [convMessages, setConvMessages] = useState<Message[] | null>(null);
  const [viewingConv, setViewingConv] = useState<Conversation | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ items: User[] }>('/admin/users', { params: { search: search || undefined, phone: phone || undefined, pageSize: 100 } });
      setUsers(data.items);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function viewUser(u: User) {
    setSelected(u);
    setUserConversations(null);
    try {
      const { data } = await api.get<{ items: Conversation[] }>(`/admin/users/${u.id}/conversations`);
      setUserConversations(data.items);
    } catch {}
  }

  async function viewConversation(conv: Conversation) {
    setViewingConv(conv);
    setConvMessages(null);
    try {
      const { data } = await api.get<{ items: Message[] }>(`/admin/conversations/${conv.id}/messages`, { params: { pageSize: 200 } });
      setConvMessages(data.items);
    } catch {}
  }

  async function changeRole(u: User, role: 'USER' | 'ADMIN') {
    try {
      await api.put(`/admin/users/${u.id}/role`, { role });
      toast.success(`نقش به ${role === 'ADMIN' ? 'مدیر' : 'کاربر'} تغییر کرد.`);
      load();
    } catch { toast.error('خطا در تغییر نقش.'); }
  }

  async function changeStatus(u: User, status: 'ACTIVE' | 'DISABLED') {
    try {
      await api.put(`/admin/users/${u.id}/status`, { status });
      toast.success(`وضعیت به ${status === 'ACTIVE' ? 'فعال' : 'غیرفعال'} تغییر کرد.`);
      load();
    } catch { toast.error('خطا در تغییر وضعیت.'); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">مدیریت کاربران</h1>
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام..."
            className="w-full pr-9 pl-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm"
          />
        </div>
        <input
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="شماره تلفن"
          className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm"
        />
        <button onClick={load} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">جستجو</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="loader" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs">
                <tr>
                  <th className="p-3">کاربر</th>
                  <th className="p-3">شماره</th>
                  <th className="p-3">نقش</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3">آخرین بازدید</th>
                  <th className="p-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.fullName} url={u.avatarUrl} size={32} />
                        <div className="font-medium text-gray-900 dark:text-gray-100">{u.fullName}</div>
                      </div>
                    </td>
                    <td className="p-3" dir="ltr">{formatPhone(u.phoneNumber)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.role === 'ADMIN' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {u.role === 'ADMIN' ? 'مدیر' : 'کاربر'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {u.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">{u.lastSeen ? relativeTime(u.lastSeen) : '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => viewUser(u)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">مشاهده</button>
                        {u.status === 'ACTIVE' ? (
                          <button onClick={() => changeStatus(u, 'DISABLED')} className="px-2 py-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded">غیرفعال</button>
                        ) : (
                          <button onClick={() => changeStatus(u, 'ACTIVE')} className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded">فعال</button>
                        )}
                        {u.role === 'USER' ? (
                          <button onClick={() => changeRole(u, 'ADMIN')} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">ادمین</button>
                        ) : (
                          <button onClick={() => changeRole(u, 'USER')} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded">کاربر</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User detail modal */}
      {selected && (
        <Modal onClose={() => { setSelected(null); setUserConversations(null); }} title="جزئیات کاربر">
          <div className="text-center mb-4">
            <Avatar name={selected.fullName} url={selected.avatarUrl} size={80} />
            <h3 className="text-lg font-bold mt-2">{selected.fullName}</h3>
            <p className="text-sm text-gray-500" dir="ltr">{formatPhone(selected.phoneNumber)}</p>
            <div className="flex justify-center gap-2 mt-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${selected.role === 'ADMIN' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{selected.role === 'ADMIN' ? 'مدیر' : 'کاربر'}</span>
              <span className={`px-2 py-0.5 rounded-full ${selected.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{selected.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}</span>
            </div>
          </div>
          <h4 className="text-sm font-semibold mb-2">گفتگوها</h4>
          {userConversations === null ? (
            <div className="flex justify-center"><div className="loader" /></div>
          ) : userConversations.length === 0 ? (
            <p className="text-sm text-gray-500">گفتگویی وجود ندارد.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {userConversations.map((c) => (
                <button key={c.id} onClick={() => viewConversation(c)} className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm text-right">
                  <Avatar name={c.otherParticipant?.fullName} url={c.otherParticipant?.avatarUrl} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{c.otherParticipant?.fullName || 'نامشخص'}</div>
                    <div className="text-xs text-gray-500 truncate">{c.lastMessagePreview || 'بدون پیام'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Conversation messages modal */}
      {viewingConv && (
        <Modal onClose={() => { setViewingConv(null); setConvMessages(null); }} title="پیام‌های گفتگو" wide>
          {convMessages === null ? (
            <div className="flex justify-center py-8"><div className="loader" /></div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {convMessages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">پیامی وجود ندارد.</p>
              ) : (
                [...convMessages].reverse().map((m) => (
                  <div key={m.id} className={`max-w-[80%] p-2 rounded text-sm ${m.senderId === selected?.id ? 'bg-[#dcf8c6] ml-auto' : 'bg-white'}`}>
                    <div>{m.content || '📎 فایل'}</div>
                    <div className="text-[10px] text-gray-500 mt-1">{relativeTime(m.createdAt)} • {m.senderName}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl ${wide ? 'max-w-3xl' : 'max-w-md'} w-full max-h-[85vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
