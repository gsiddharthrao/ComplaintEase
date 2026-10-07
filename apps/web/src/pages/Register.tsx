import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@complaintease/shared';
import { api } from '../lib/api-client.js';
import { ShieldAlert, UserPlus } from 'lucide-react';

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
    defaultRole: 'employee',
  } as any);

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    setSuccessMsg(null);
    try {
      await api.auth.register(data);
      setSuccessMsg('Account created successfully! You can now log in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setServerError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500 text-white shadow-lg mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Create an Account</h2>
        <p className="mt-1 text-xs text-slate-400">Join the enterprise complaint management portal</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-8 border border-slate-100">
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
                placeholder="Jane Doe"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              {errors.full_name && (
                <p className="text-xs text-rose-600 mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="jane@company.com"
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                {...register('role')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              >
                <option value="employee">Employee</option>
                <option value="dept_head">Department Head</option>
                <option value="admin">System Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex justify-center items-center space-x-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:ring-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Registering...' : 'Register'}</span>
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
