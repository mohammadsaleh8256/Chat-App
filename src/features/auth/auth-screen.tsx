'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Phone, Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

interface AuthScreenProps {
  initialMode?: 'login' | 'register';
}

export function AuthScreen({ initialMode = 'login' }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuthStore();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(phone, password);
        toast.success(`خوش آمدید، ${user.firstName}!`);
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          toast.error('نام و نام خانوادگی را وارد کنید');
          setSubmitting(false);
          return;
        }
        const user = await register({ firstName, lastName, phone, password });
        toast.success(`ثبت‌نام موفق! خوش آمدید ${user.firstName}`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'خطای ناشناخته';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <MessageCircle className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">چت‌گرام</h1>
            <p className="text-sm text-muted-foreground mt-1">
              پیام‌رسان فارسی، امن و سریع
            </p>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {mode === 'login' ? 'ورود' : 'ثبت‌نام'}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === 'login'
                ? 'برای ادامه وارد حساب خود شوید'
                : 'یک حساب کاربری جدید بسازید'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">نام</Label>
                    <div className="relative">
                      <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="مثال: محمد"
                        className="pr-9"
                        autoComplete="given-name"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">نام خانوادگی</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="مثال: صالح"
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">شماره موبایل</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09123456789"
                    className="pr-9 text-right"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="pr-9"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={submitting || !phone || !password}
              >
                {submitting ? 'در حال پردازش...' : mode === 'login' ? 'ورود' : 'ثبت‌نام'}
              </Button>
            </form>

            <div className="text-center mt-4 text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  حساب ندارید؟{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-primary font-medium hover:underline"
                  >
                    ثبت‌نام کنید
                  </button>
                </>
              ) : (
                <>
                  قبلاً ثبت‌نام کرده‌اید؟{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-primary font-medium hover:underline"
                  >
                    وارد شوید
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          با ورود یا ثبت‌نام، شرایط استفاده و حریم خصوصی را می‌پذیرید.
        </p>
      </div>
    </div>
  );
}
