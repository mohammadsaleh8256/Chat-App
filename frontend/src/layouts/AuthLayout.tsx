import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

export default function AuthLayout() {
  const { user, initialized } = useAuthStore();
  if (initialized && user) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
    }}>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
