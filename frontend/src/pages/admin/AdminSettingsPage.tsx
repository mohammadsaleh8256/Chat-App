import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ phoneNumber: string }>('/admin/settings/admin-phone')
      .then(({ data }) => setPhone(data.phoneNumber))
      .catch(() => {});
  }, []);

  async function save() {
    setLoading(true);
    try {
      await api.put('/admin/settings/admin-phone', { phoneNumber: phone });
      toast.success('شماره مدیر به‌روزرسانی شد.');
    } catch { toast.error('خطا در به‌روزرسانی.'); }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">تنظیمات</h1>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm max-w-lg">
        <h3 className="font-semibold mb-2">شماره تلفن مدیر اولیه</h3>
        <p className="text-xs text-gray-500 mb-4">
          شماره‌ای که در زمان ثبت‌نام، نقش Admin به‌طور خودکار به آن تعلق می‌گیرد.
        </p>
        <div className="flex gap-2">
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09162744975"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg text-sm"
          />
          <button onClick={save} disabled={loading} className="px-4 py-2 bg-accent text-white rounded-lg text-sm">
            {loading ? 'در حال ذخیره...' : 'ذخیره'}
          </button>
        </div>
      </div>
    </div>
  );
}
