import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatusBadge } from '../../components/complaints/StatusBadge.js';
import { PriorityBadge } from '../../components/complaints/PriorityBadge.js';
import { Kanban, Filter, Search, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ComplaintStatus, ComplaintPriority } from '@complaintease/shared';

export const DeptHeadBoard: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | ''>('');

  // Fetch complaints
  const { data, isLoading } = useQuery({
    queryKey: ['complaints', { search, status: statusFilter, priority: priorityFilter, dept: profile?.department_id }],
    queryFn: () =>
      api.complaints.list({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        department_id: profile?.department_id || undefined,
        limit: 100,
      }),
  });

  // Fetch staff users for assignment
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.admin.getUsers(),
  });

  const complaints = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Kanban className="w-6 h-6 text-brand-600" />
          Department Triage Board
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Review, assign specialists, and resolve complaints submitted to your department.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search department complaints..."
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

      {/* Board table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading complaints...</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No complaints awaiting triage in your department.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Complaint</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Assignee</th>
                <th className="px-4 py-3.5">Filed</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {complaints.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <Link
                      to={`/complaints/${item.id}`}
                      className="font-semibold text-slate-900 hover:text-brand-600 block truncate max-w-xs"
                    >
                      {item.title}
                    </Link>
                    <span className="text-xs text-slate-400">
                      by {item.creator?.full_name || 'Staff'} • {item.category?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-700">
                    {item.assigned_to?.full_name ? (
                      <span className="font-medium text-slate-800">{item.assigned_to.full_name}</span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      to={`/complaints/${item.id}`}
                      className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                    >
                      <span>Triage</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

