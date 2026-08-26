import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { chatSocket } from '../services/socket';
import { Avatar } from '../components/Avatar';
import { LayoutDashboard, Users, ScrollText, Settings, ArrowRight, LogOut } from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'داشبورد', end: true },
  { to: '/admin/users', icon: Users, label: 'کاربران' },
  { to: '/admin/conversations', icon: ScrollText, label: 'گفتگوها' },
  { to: '/admin/audit-logs', icon: ScrollText, label: 'لاگ‌های ممیزی' },
  { to: '/admin/settings', icon: Settings, label: 'تنظیمات' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await chatSocket.disconnect();
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <aside className="w-60 bg-primary text-white flex flex-col">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-bold">پنل مدیر</h2>
          <div className="flex items-center gap-2 mt-2">
            <Avatar name={user?.fullName} url={user?.avatarUrl} size={32} />
            <div className="text-xs">
              <div className="font-semibold">{user?.fullName}</div>
              <div className="opacity-70">مدیر سیستم</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/app" className="flex items-center gap-3 px-5 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white">
            <ArrowRight size={18} />
            بازگشت به چت
          </NavLink>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white">
            <LogOut size={18} />
            خروج
          </button>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        <Outlet />
      </main>
    </div>
  );
}
