import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import { Layout } from './components/layout/Layout.js';

// React.lazy route-based code splitting for minimal initial bundle
const Login = lazy(() => import('./pages/Login.js').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register.js').then((m) => ({ default: m.Register })));
const EmployeeDashboard = lazy(() =>
  import('./pages/employee/EmployeeDashboard.js').then((m) => ({ default: m.EmployeeDashboard })),
);
const NewComplaint = lazy(() =>
  import('./pages/employee/NewComplaint.js').then((m) => ({ default: m.NewComplaint })),
);
const ComplaintDetail = lazy(() =>
  import('./pages/ComplaintDetail.js').then((m) => ({ default: m.ComplaintDetail })),
);
const AdminPanel = lazy(() =>
  import('./pages/admin/AdminPanel.js').then((m) => ({ default: m.AdminPanel })),
);

const RoleBasedRedirect: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/employee" replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RealtimeSyncListener: React.FC = () => {
  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('complaintease_storage_sync', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('complaintease_storage_sync', handleSync);
    };
  }, []);
  return null;
};

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RealtimeSyncListener />
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Authenticated Workspace */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<RoleBasedRedirect />} />

                {/* Employee / General routes */}
                <Route
                  path="/employee"
                  element={
                    <ProtectedRoute allowedRoles={['employee', 'admin']}>
                      <EmployeeDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/complaints/new"
                  element={
                    <ProtectedRoute allowedRoles={['employee']}>
                      <NewComplaint />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/complaints/:id"
                  element={
                    <ProtectedRoute allowedRoles={['employee', 'admin']}>
                      <ComplaintDetail />
                    </ProtectedRoute>
                  }
                />

                {/* System Admin Control */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminPanel />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

