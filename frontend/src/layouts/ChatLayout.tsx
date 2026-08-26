import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { chatSocket } from '../services/socket';
import { formatPhone } from '../utils';
import { Avatar } from '../components/Avatar';
import { LogOut, MessageSquarePlus, Shield, Settings } from 'lucide-react';

export default function ChatLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Connect socket on mount
    chatSocket.connect();

    return () => {
      // Don't disconnect on every navigation — only on logout
    };
  }, []);

  async function handleLogout() {
    await chatSocket.disconnect();
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden md:flex w-80 flex-col bg-white dark:bg-gray-800 border-l dark:border-gray-700">
        {/* Header */}
        <div className="bg-primary text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={user?.fullName} url={user?.avatarUrl} size={40} />
            <div>
              <div className="font-semibold text-sm">{user?.fullName}</div>
              <div className="text-xs opacity-80" dir="ltr">{user && formatPhone(user.phoneNumber)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NavLink to="/app/new" className="p-2 rounded-full hover:bg-white/10" title="گفتگوی جدید">
              <MessageSquarePlus size={20} />
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className="p-2 rounded-full hover:bg-white/10 text-yellow-300" title="پنل مدیر">
                <Shield size={18} />
              </NavLink>
            )}
            <button onClick={handleLogout} className="p-2 rounded-full hover:bg-white/10" title="خروج">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Content slot (conversation list etc.) */}
        <div className="flex-1 overflow-y-auto">
          {/* Will be filled by ChatPage via Outlet (or a side component) */}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
