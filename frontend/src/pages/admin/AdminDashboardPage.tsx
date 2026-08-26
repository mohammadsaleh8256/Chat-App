import { useEffect, useState } from 'react';
import api from '../../services/api';
import type { DashboardStats } from '../../types';
import { formatFileSize } from '../../utils';
import { Users, Wifi, MessageSquare, FileText, Shield, Ban, HardDrive, Upload } from 'lucide-react';

const ICONS = [
  { key: 'totalUsers', icon: Users, label: 'کل کاربران', color: 'text-blue-500' },
  { key: 'onlineUsers', icon: Wifi, label: 'آنلاین', color: 'text-green-500' },
  { key: 'totalConversations', icon: MessageSquare, label: 'گفتگوها', color: 'text-purple-500' },
  { key: 'totalMessages', icon: MessageSquare, label: 'پیام‌ها', color: 'text-orange-500' },
  { key: 'totalAttachments', icon: FileText, label: 'فایل‌ها', color: 'text-pink-500' },
  { key: 'totalAdmins', icon: Shield, label: 'مدیران', color: 'text-yellow-500' },
  { key: 'disabledUsers', icon: Ban, label: 'غیرفعال‌ها', color: 'text-red-500' },
  { key: 'activeUploads', icon: Upload, label: 'آپلودهای فعال', color: 'text-cyan-500' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>('/admin/dashboard').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  if (!stats) return <div className="flex justify-center py-12"><div className="loader" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">داشبورد</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ICONS.map(({ key, icon: Icon, label, color }) => (
          <div key={key} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700 ${color}`}>
              <Icon size={28} />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {(stats as any)[key]}
              </div>
            </div>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-indigo-500">
            <HardDrive size={28} />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">حجم فایل‌ها</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatFileSize(stats.totalAttachmentSizeBytes)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
