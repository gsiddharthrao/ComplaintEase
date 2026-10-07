import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import type { UserRole } from '@complaintease/shared';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // Redirect to their appropriate home dashboard based on role
    const homeMap: Record<UserRole, string> = {
      employee: '/employee',
      dept_head: '/dept-head',
      admin: '/admin',
    };
    return <Navigate to={homeMap[profile.role]} replace />;
  }

  return <>{children}</>;
};
