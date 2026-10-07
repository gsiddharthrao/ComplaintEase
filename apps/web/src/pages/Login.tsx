import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ShieldCheck, LogIn, KeyRound, UserCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const initialEmail = queryParams.get('email') || '';
  const isRegisteredSuccess = Boolean(queryParams.get('registered'));

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    isRegisteredSuccess ? 'Registration complete! Sign in with your new employee credentials.' : null,
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const stored = localStorage.getItem('complaintease_demo_user') || email;
      if (stored === 'sidd@gmail.com' || stored.includes('admin')) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/employee', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Check email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handle1ClickAdminLogin = async () => {
    setEmail('sidd@gmail.com');
    setPassword('Sidd1234');
    setLoading(true);
    setError(null);
    try {
      await login('sidd@gmail.com', 'Sidd1234');
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Admin sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Complaint<span className="text-brand-400">Ease</span>
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Plant Operations & Industrial Incident Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              ✓ {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sidd@gmail.com or employee@plant.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Dedicated Administrator 1-Click Sign-In */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-brand-600" />
                  Sole Administrator Credentials
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Primary Superadmin
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Email: <strong className="font-mono text-slate-800">sidd@gmail.com</strong> • Pass: <strong className="font-mono text-slate-800">Sidd1234</strong>
              </p>
              <button
                type="button"
                onClick={handle1ClickAdminLogin}
                className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <UserCheck className="w-4 h-4" />
                <span>1-Click Sign In as Siddharth (Admin)</span>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">
            New employee or plant operator?{' '}
            <Link to="/register" className="text-brand-600 font-semibold hover:underline">
              Create Employee Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

