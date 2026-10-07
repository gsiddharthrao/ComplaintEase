import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/complaints/StatusBadge.js';
import { PriorityBadge } from '../components/complaints/PriorityBadge.js';
import { Timeline } from '../components/complaints/Timeline.js';
import { CommentsThread } from '../components/complaints/CommentsThread.js';
import { AttachmentsList } from '../components/complaints/AttachmentsList.js';
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  ComplaintStatus,
} from '@complaintease/shared';
import {
  ArrowLeft,
  Clock,
  User,
  Building2,
  Tag,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  UserPlus,
} from 'lucide-react';

export const ComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'timeline' | 'comments' | 'attachments'>('timeline');
  const [transitionNote, setTransitionNote] = useState('');
  const [selectedNextStatus, setSelectedNextStatus] = useState<ComplaintStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignNote, setAssignNote] = useState('');

  const { data: complaint, isLoading, error } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => api.complaints.get(id!),
    enabled: Boolean(id),
  });

  // Fetch users for assignment if dept_head or admin
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.admin.getUsers(),
    enabled: profile?.role === 'dept_head' || profile?.role === 'admin',
  });

  const transitionMutation = useMutation({
    mutationFn: (data: { new_status: ComplaintStatus; note: string; expected_version: number }) =>
      api.complaints.transition(id!, data),
    onSuccess: () => {
      setSelectedNextStatus(null);
      setTransitionNote('');
      setTransitionError(null);
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (err: any) => {
      setTransitionError(err.message || 'Status transition failed.');
    },
  });

  const assignMutation = useMutation({
    mutationFn: (data: { assigned_to: string; note: string }) =>
      api.complaints.assign(id!, data),
    onSuccess: () => {
      setShowAssignModal(false);
      setAssigneeId('');
      setAssignNote('');
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
    },
    onError: (err: any) => {
      setTransitionError(err.message || 'Assignment failed.');
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading complaint details...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
        <h3 className="font-semibold text-base mb-1">Error Loading Complaint</h3>
        <p className="text-xs">{(error as any)?.message || 'Complaint not found or access denied.'}</p>
        <Link to="/employee" className="mt-4 inline-block text-xs font-semibold text-brand-600 underline">
          Return to dashboard
        </Link>
      </div>
    );
  }

  // Calculate allowed transitions
  const currentStatus = complaint.status as ComplaintStatus;
  const rawAllowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  const userRole = profile?.role || 'employee';

  // Filter transitions permitted for user role
  const allowedForRole = rawAllowed.filter((targetStatus) => {
    if (userRole === 'admin') return true;
    if (userRole === 'dept_head') return true;
    if (userRole === 'employee') {
      // Employees can only reopen their own resolved complaints
      return targetStatus === 'reopened' && currentStatus === 'resolved' && complaint.created_by === profile?.id;
    }
    return false;
  });

  const handleExecuteTransition = (newStatus: ComplaintStatus) => {
    transitionMutation.mutate({
      new_status: newStatus,
      note: transitionNote,
      expected_version: complaint.version,
    });
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId) return;
    assignMutation.mutate({
      assigned_to: assigneeId,
      note: assignNote,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button & top meta */}
      <div className="flex items-center justify-between">
        <Link
          to="/employee"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Complaints</span>
        </Link>

        <span className="text-xs text-slate-400 font-mono">
          ID: {complaint.id.slice(0, 8)}... (v{complaint.version})
        </span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <StatusBadge status={currentStatus} />
            <PriorityBadge priority={complaint.priority} />
          </div>

          {/* Quick Actions (Assign / Transition) */}
          <div className="flex items-center space-x-2">
            {(userRole === 'dept_head' || userRole === 'admin') && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{complaint.assigned_to ? 'Reassign' : 'Assign'}</span>
              </button>
            )}
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {complaint.title}
        </h1>

        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          {complaint.description}
        </p>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
              <span className="font-semibold text-slate-800">{complaint.department?.name || 'General'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
              <span className="font-semibold text-slate-800">{complaint.category?.name || 'General'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted By</span>
              <span className="font-semibold text-slate-800">{complaint.creator?.full_name || 'Staff'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Worker</span>
              <span className="font-semibold text-slate-800">
                {complaint.assigned_to?.full_name || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* State Machine Transition Actions Card */}
      {allowedForRole.length > 0 && (
        <div className="bg-brand-50/60 border border-brand-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            Available Lifecycle Transitions (Optimistic Lock v{complaint.version})
          </h3>

          {transitionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{transitionError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {allowedForRole.map((nextStatus) => (
              <button
                key={nextStatus}
                onClick={() => setSelectedNextStatus(nextStatus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                  selectedNextStatus === nextStatus
                    ? 'bg-brand-700 text-white ring-2 ring-brand-500'
                    : 'bg-white hover:bg-brand-100 text-slate-800 border border-slate-200'
                }`}
              >
                Transition to: <strong>{nextStatus.replace('_', ' ')}</strong>
              </button>
            ))}
          </div>

          {selectedNextStatus && (
            <div className="mt-3 p-4 bg-white rounded-xl border border-brand-200 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Reason / Resolution Note (recorded in immutable status history)
              </label>
              <input
                type="text"
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="Brief reason for transition (e.g. Investigation completed and verified)..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedNextStatus(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExecuteTransition(selectedNextStatus)}
                  disabled={transitionMutation.isPending}
                  className="px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {transitionMutation.isPending ? 'Processing...' : 'Confirm Transition'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Assign Complaint</h3>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Assignee
                </label>
                <select
                  required
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                >
                  <option value="">Select Staff Member...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Assignment Note
                </label>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Task instructions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs: Timeline vs Discussion vs Attachments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 flex">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === 'timeline'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Timeline & Audit History
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === 'comments'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Discussion Thread
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 text-center transition-colors ${
              activeTab === 'attachments'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Evidence & Attachments
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'timeline' && <Timeline history={complaint.status_history || []} />}
          {activeTab === 'comments' && <CommentsThread complaintId={complaint.id} />}
          {activeTab === 'attachments' && <AttachmentsList complaintId={complaint.id} />}
        </div>
      </div>
    </div>
  );
};
