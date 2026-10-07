import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@complaintease/shared';
import { api } from '../lib/api-client.js';
import { ShieldCheck, UserPlus, Info, Lock } from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'employee',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    setSuccessMsg(null);
    try {
      // Strictly enforce role is employee for all public registrations
      await api.auth.register({
        ...data,
        role: 'employee',
      });
      setSuccessMsg(`Employee account created for ${data.email}! Redirecting to login...`);
      setTimeout(() => {
        navigate(`/login?registered=1&email=${encodeURIComponent(data.email)}`);
      }, 1200);
    } catch (err: any) {
      setServerError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500 text-white shadow-lg mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Create Employee Account</h2>
        <p className="mt-1 text-xs text-slate-400">
          Register as a plant operator or staff member to report machinery faults and track resolutions
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-8 border border-slate-100">
          {/* Security & Access Notice */}
          <div className="mb-5 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-sky-900">Employee Self-Registration:</span> All public registrations create standard Employee/Operator accounts. Administrator privileges are reserved and strictly managed.
            </div>
          </div>

          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {serverError}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              {successMsg}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                {...register('full_name')}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              {errors.full_name && (
                <p className="text-xs text-rose-600 mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Work Email
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="ramesh@plant.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              {errors.email && (
                <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              {errors.password && (
                <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Locked Role Indicator */}
            <div className="pt-1">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Assigned Role: <strong className="text-slate-800">Plant Operator / Employee</strong></span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex justify-center items-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Account...' : 'Register Employee Account'}</span>
            </button>
          </form>

          {/* Admin Guidance Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Plant Operations Director or Supervisor?
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Please sign in using your designated administrator account (<span className="font-mono text-slate-600">admin@demo.com</span>).
            </p>
            <div className="mt-3">
              <Link to="/login" className="inline-flex items-center text-xs font-semibold text-brand-600 hover:underline">
                Return to Sign In &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

