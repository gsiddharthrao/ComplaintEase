import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { createComplaintSchema, CreateComplaintInput } from '@complaintease/shared';
import { api } from '../../lib/api-client.js';
import { Send, ArrowLeft, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NewComplaint: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch departments & categories
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.admin.getDepartments(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.admin.getCategories(),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateComplaintInput>({
    resolver: zodResolver(createComplaintSchema),
    defaultValues: {
      priority: 'medium',
    },
  });

  const selectedDept = watch('department_id');
  const filteredCategories = selectedDept
    ? categories.filter((c) => !c.department_id || c.department_id === selectedDept)
    : categories;

  const onSubmit = async (data: CreateComplaintInput) => {
    setServerError(null);
    try {
      const result = await api.complaints.create(data);
      navigate(`/complaints/${result.id}`);
    } catch (err: any) {
      setServerError(err.message || 'Failed to submit complaint');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link
          to="/employee"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">File a Complaint</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit a formal incident or grievance for investigation and resolution.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Department Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Department *
              </label>
              <select
                {...register('department_id')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">Select Department...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {errors.department_id && (
                <p className="text-xs text-rose-600 mt-1">{errors.department_id.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                {...register('category_id')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">Select Category...</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-xs text-rose-600 mt-1">{errors.category_id.message}</p>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Urgency / Priority Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((tier) => (
                <label
                  key={tier}
                  className="flex items-center justify-center space-x-2 p-2.5 border rounded-lg cursor-pointer text-xs font-medium capitalize transition-all hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    value={tier}
                    {...register('priority')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span>{tier}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Complaint Subject / Title *
            </label>
            <input
              {...register('title')}
              placeholder="Concise summary (e.g. WiFi outage in Floor 3 conference room)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {errors.title && (
              <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Comprehensive Description *
            </label>
            <textarea
              {...register('description')}
              rows={5}
              placeholder="Please provide full details, timestamps, error messages, and business impact (minimum 20 characters)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
            {errors.description && (
              <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Filing Complaint...' : 'Submit Complaint'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

