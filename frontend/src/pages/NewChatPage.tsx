import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { UserSummary } from '../types';
import { Avatar } from '../components/Avatar';
import { formatPhone, relativeTime } from '../utils';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Conversation } from '../types';

export default function NewChatPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<any>(null);

  const load = async (s: string) => {
    setLoading(true);
    try {
      const { data } = await api.get<{ items: UserSummary[] }>('/users', { params: { search: s || undefined, pageSize: 100 } });
      setUsers(data.items);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    load('');
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  async function start(userId: string) {
    try {
      const { data: conv } = await api.post<Conversation>('/conversations', { otherUserId: userId });
      toast.success('گفتگو ایجاد شد.');
      navigate('/app');
    } catch {
      toast.error('ایجاد گفتگو ناموفق بود.');
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <header className="bg-primary text-white p-4 flex items-center gap-3">
        <button onClick={() => navigate('/app')} className="p-1 rounded-full hover:bg-white/10">
          <ArrowRight size={20} />
        </button>
        <h2 className="text-base font-semibold">گفتگوی جدید</h2>
      </header>
      <div className="p-3 border-b dark:border-gray-700">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی کاربر..."
          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8"><div className="loader" /></div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-500 py-12">کاربری یافت نشد.</div>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              onClick={() => start(u.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-right border-b dark:border-gray-700"
            >
              <Avatar name={u.fullName} url={u.avatarUrl} size={48} isOnline={u.isOnline} showStatus />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{u.fullName}</div>
                <div className="text-xs text-gray-500" dir="ltr">{formatPhone(u.phoneNumber)}</div>
              </div>
              <div className="text-xs text-gray-400">
                {u.isOnline ? 'آنلاین' : u.lastSeen ? `آخرین بازدید ${relativeTime(u.lastSeen)}` : 'آفلاین'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
