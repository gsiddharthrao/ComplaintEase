import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client.js';
import { StatusBadge } from '../../components/complaints/StatusBadge.js';
import { PriorityBadge } from '../../components/complaints/PriorityBadge.js';
import { PlusCircle, Search, Filter, AlertCircle, Clock, ChevronRight, MapPin, Camera } from 'lucide-react';
import type { ComplaintStatus, ComplaintPriority } from '@complaintease/shared';

export const EmployeeDashboard: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | ''>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['complaints', { search, status: statusFilter, priority: priorityFilter }],
    queryFn: () =>
      api.complaints.list({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        limit: 50,
      }),
  });

  const complaints = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Complaints Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track status, review updates, and collaborate on resolutions.
          </p>
        </div>

        <Link
          to="/complaints/new"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>File New Complaint</span>
        </Link>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search complaints by title, keyword, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white outline-none"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
            <option value="reopened">Reopened</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Complaints List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading complaints...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <p className="text-sm font-semibold">Failed to load complaints</p>
          <p className="text-xs mt-1">{(error as any)?.message}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No complaints found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search || statusFilter || priorityFilter
              ? 'Try adjusting your filters or search terms.'
              : 'You have not submitted any complaints yet.'}
          </p>
          <Link
            to="/complaints/new"
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create your first complaint</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {complaints.map((item) => (
            <Link
              key={item.id}
              to={`/complaints/${item.id}`}
              className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group block"
            >
              <div className="min-w-0 pr-4 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <StatusBadge status={item.status} />
                  <PriorityBadge priority={item.priority} />
                  <span className="text-xs text-slate-400 font-medium">
                    • {item.department?.name || 'General'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    • {item.category?.name || 'Category'}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                  {item.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2">
                  <span>Filed {new Date(item.created_at).toLocaleDateString()}</span>
                  {item.assigned_to && (
                    <span>Assigned to: <strong className="text-slate-600">{item.assigned_to.full_name}</strong></span>
                  )}
                  {item.location_lat != null && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[150px]">{item.location_address || 'Geotagged'}</span>
                    </span>
                  )}
                  {item.image_url && (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      <Camera className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>Photo Attached</span>
                    </span>
                  )}
                  <span>Version {item.version}</span>
                </div>
              </div>

              {item.image_url && (
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 mr-3 hidden sm:block">
                  <img src={item.image_url} alt="Evidence thumbnail" className="w-full h-full object-cover" />
                </div>
              )}

              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

