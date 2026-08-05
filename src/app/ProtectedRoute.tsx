import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isValid = useAuthStore((s) => s.isSessionValid());
  const location = useLocation();

  if (!isValid) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
