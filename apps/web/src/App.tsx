import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext.js';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
                <Route path="/" element={<Navigate to="/employee" replace />} />

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
                    <ProtectedRoute allowedRoles={['employee', 'admin']}>
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
    </QueryClientProvider>
  );
}

export default App;

