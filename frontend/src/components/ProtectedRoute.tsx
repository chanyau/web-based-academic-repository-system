import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('student' | 'lecturer' | 'admin' | 'public')[];
  fallbackPath?: string;
}

export const ProtectedRoute = ({ children, allowedRoles, fallbackPath }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && user.role && !allowedRoles.includes(user.role)) {
    // If user is a public user and not admitted, redirect to dashboard/login
    if (user.role === 'public' && !user.admitted) {
      return <Navigate to={fallbackPath ?? '/dashboard'} replace />;
    }
    return <Navigate to={fallbackPath ?? '/dashboard'} replace />;
  }

  return <>{children}</>;
};
