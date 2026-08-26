import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { tokenStorage } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import type { AuthResponse } from '../types';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', {
        firstName, lastName, phoneNumber, password,
      });
      tokenStorage.set(data.accessToken, data.refreshToken);
      setUser(data.user);
      toast.success('ثبت‌نام موفق!');
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'خطا در ثبت‌نام.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-2xl">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-3">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.5 2 2 6 2 11c0 1.8.6 3.5 1.6 5L2 22l6-1.6c1.5.7 3 1 4.5 1 5.5 0 10-4 10-9S17.5 2 12 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">ثبت‌نام در چت‌اپ</h1>
        <p className="text-sm text-gray-500 mt-1">پیام‌رسان سریع و امن</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="نام"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام خانوادگی</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="نام خانوادگی"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">شماره تلفن</label>
          <input
            type="tel"
            dir="ltr"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="09162744975"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="حداقل ۶ کاراکتر"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            required
            minLength={6}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <span className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} />}
          {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        حساب دارید؟{' '}
        <Link to="/login" className="text-primary font-semibold hover:underline">وارد شوید</Link>
      </p>
    </div>
  );
}
