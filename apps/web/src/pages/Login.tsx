import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../lib/api-client.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import {
  ShieldAlert,
  LogIn,
  Lock,
  Mail,
  User,
  ShieldCheck,
  UserCheck,
  Building,
  KeyRound,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, login } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/employee', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  const queryParams = new URLSearchParams(location.search);
  const defaultPortal = queryParams.get('portal') === 'admin' ? 'admin' : 'staff';
  const defaultStaffMode = queryParams.get('mode') === 'register' ? 'register' : 'signin';

  // Primary portal tab: 'staff' (Employees / Plant Workers) | 'admin' (Plant Admin)
  const [activePortal, setActivePortal] = useState<'staff' | 'admin'>(defaultPortal);

  // Staff sub-mode: 'signin' (Existing staff) | 'register' (New staff)
  const [staffMode, setStaffMode] = useState<'signin' | 'register'>(defaultStaffMode);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset fields & errors on tab change
  const handlePortalSwitch = (portal: 'staff' | 'admin') => {
    setActivePortal(portal);
    setError(null);
    setSuccess(null);
    setEmail('');
    setPassword('');
  };

  const handleStaffModeSwitch = (mode: 'signin' | 'register') => {
    setStaffMode(mode);
    setError(null);
    setSuccess(null);
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (activePortal === 'admin') {
        // Admin sign in
        await login(email.trim(), password);
        navigate('/admin', { replace: true });
      } else if (staffMode === 'signin') {
        // Existing staff sign in
        await login(email.trim(), password);
        navigate('/employee', { replace: true });
      } else {
        // New staff registration
        if (!fullName.trim() || fullName.trim().length < 2) {
          throw new Error('Please enter your full name (minimum 2 characters).');
        }
        await api.auth.register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role: 'employee',
        });
        // Automatically login the newly registered user
        await login(email.trim(), password);
        navigate('/employee', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-500/10 dark:bg-brand-500/15 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Top navbar controls (Theme toggle) */}
      <div className="absolute top-5 right-5 sm:top-6 sm:right-8 z-20 flex items-center gap-3">
        <ThemeToggle showLabel={true} className="backdrop-blur-md shadow-md" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center relative z-10 mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white shadow-xl shadow-brand-500/25 mb-3.5 transform hover:scale-105 transition-transform duration-300">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors">
          Complaint<span className="text-brand-600 dark:text-brand-400">Ease</span>
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto transition-colors">
          Enterprise Plant Operations & Incident Resolution Portal
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        {/* Main Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-7 px-5 sm:px-9 shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 transition-all duration-300">
          
          {/* Primary Portal Switcher Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-6 border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handlePortalSwitch('staff')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                activePortal === 'staff'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Staff & Employees</span>
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                activePortal === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* If Staff Portal: Sub-toggle for Sign In vs Create Account */}
          {activePortal === 'staff' && (
            <div className="mb-6">
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleStaffModeSwitch('signin')}
                  className={`flex-1 pb-2.5 text-xs sm:text-sm font-semibold transition-all relative ${
                    staffMode === 'signin'
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  Existing User (Sign In)
                  {staffMode === 'signin' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffModeSwitch('register')}
                  className={`flex-1 pb-2.5 text-xs sm:text-sm font-semibold transition-all relative ${
                    staffMode === 'register'
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  New User (Create Account)
                  {staffMode === 'register' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </button>
              </div>

              {/* Informative Helper text */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                {staffMode === 'signin'
                  ? 'Sign in with your email & password to review previously raised complaints, track live progress, and file new incident tickets.'
                  : 'Register a staff profile to begin reporting machinery breakdowns and safety hazards.'}
              </p>
            </div>
          )}

          {/* If Admin Portal: Informative Header */}
          {activePortal === 'admin' && (
            <div className="mb-6 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Superadmin Access Control</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Authorized access for plant managers to assign technicians, review live GPS incident pins, and advance resolution states.
              </p>
            </div>
          )}

          {/* Feedback Messages */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2 animate-in fade-in duration-150">
              <span className="shrink-0 font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center space-x-2 animate-in fade-in duration-150">
              <span>✓</span>
              <span>{success}</span>
            </div>
          )}

          {/* The Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Full Name field (Only shown for New User registration) */}
            {activePortal === 'staff' && staffMode === 'register' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Miller"
                    className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {activePortal === 'admin' ? 'Admin Email' : 'Work Email'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activePortal === 'admin' ? 'sidd@gmail.com' : 'employee@company.com'}
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-3 flex justify-center items-center space-x-2 py-3 px-4 rounded-xl shadow-lg text-sm font-bold text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 ${
                activePortal === 'admin'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-rose-600/25'
                  : 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 shadow-brand-600/25'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>
                {loading
                  ? 'Authenticating...'
                  : activePortal === 'admin'
                  ? 'Access Admin Command Center'
                  : staffMode === 'signin'
                  ? 'Sign In to Employee Portal'
                  : 'Create Account & Sign In'}
              </span>
              <ArrowRight className="w-4 h-4 ml-1 opacity-75" />
            </button>
          </form>

          {/* Quick toggle footer for staff */}
          {activePortal === 'staff' && (
            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              {staffMode === 'signin' ? (
                <span>
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => handleStaffModeSwitch('register')}
                    className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
                  >
                    Create a new account
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => handleStaffModeSwitch('signin')}
                    className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
                  >
                    Sign in to see previous complaints
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Admin tab switch helper footer */}
          {activePortal === 'admin' && (
            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              Plant employee or technician?{' '}
              <button
                type="button"
                onClick={() => handlePortalSwitch('staff')}
                className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
              >
                Go to Staff Portal
              </button>
            </div>
          )}
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Enterprise Row-Level Security • End-to-End TLS Encrypted</span>
        </div>
      </div>
    </div>
  );
};
