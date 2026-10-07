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
  MapPin,
  ExternalLink,
  Image as ImageIcon,
  Maximize2,
  X,
  Wrench,
  Zap,
} from 'lucide-react';
import { LocationMap } from '../components/common/LocationMap.js';

export const ComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'timeline' | 'comments' | 'attachments'>('timeline');
  const [transitionNote, setTransitionNote] = useState('');
  const [selectedNextStatus, setSelectedNextStatus] = useState<ComplaintStatus | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Assignment state
  const [assigneeId, setAssigneeId] = useState('');

  const { data: complaint, isLoading, error } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => api.complaints.get(id!),
    enabled: Boolean(id),
    refetchInterval: 3000,
  });

  // Fetch users for assignment if admin
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.admin.getUsers(),
    enabled: profile?.role === 'admin',
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
      setAssigneeId('');
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
    onError: (err: any) => {
      setTransitionError(err.message || 'Assignment failed.');
    },
  });

  const handleQuickAssign = (workerId: string) => {
    if (!workerId) return;
    assignMutation.mutate({
      assigned_to: workerId,
      note: 'Assigned via rapid management controls',
    });
  };

  const handleQuickInProgress = () => {
    if (!complaint) return;
    transitionMutation.mutate({
      new_status: 'in_progress',
      note: transitionNote || 'Technician dispatched and work commenced',
      expected_version: complaint.version,
    });
  };

  const handleQuickResolve = () => {
    if (!complaint) return;
    transitionMutation.mutate({
      new_status: 'resolved',
      note: transitionNote || 'Work verified and incident resolved',
      expected_version: complaint.version,
    });
  };

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button & top meta */}
      <div className="flex items-center justify-between">
        <Link
          to={userRole === 'admin' ? '/admin' : '/employee'}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Incidents</span>
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

          <div className="text-xs text-slate-400">
            Filed: {new Date(complaint.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {complaint.title}
        </h1>

        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          {complaint.description}
        </p>

        {/* Incident Image Evidence & Live Location Cards */}
        {(complaint.image_url || complaint.location_lat || complaint.location_address) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Live Location Card with Interactive OpenStreetMap */}
            {(complaint.location_lat || complaint.location_address) && (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Live Incident Location Map</span>
                  </div>
                  {complaint.location_address && (
                    <span className="text-[11px] font-semibold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[180px]">
                      {complaint.location_address}
                    </span>
                  )}
                </div>

                {complaint.location_lat && complaint.location_lng ? (
                  <LocationMap
                    lat={complaint.location_lat}
                    lng={complaint.location_lng}
                    address={complaint.location_address}
                    height="200px"
                    title={`Location for ${complaint.title}`}
                  />
                ) : (
                  <div className="p-3 bg-white rounded-lg border border-emerald-100 text-xs text-emerald-800">
                    <strong>Physical Landmark:</strong> {complaint.location_address}
                  </div>
                )}
              </div>
            )}

            {/* Attached Photo Evidence Card */}
            {complaint.image_url && (
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-800 font-bold text-xs uppercase tracking-wider">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span>Attached Evidence Photo</span>
                  </div>
                  <button
                    onClick={() => setShowImageModal(true)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-md border border-indigo-200 transition-colors shadow-sm"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Enlarge</span>
                  </button>
                </div>

                <div
                  onClick={() => setShowImageModal(true)}
                  className="cursor-pointer group relative overflow-hidden rounded-lg border border-indigo-200 aspect-video max-h-40 bg-black/5"
                >
                  <img
                    src={complaint.image_url}
                    alt="Complaint evidence"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                    <Maximize2 className="w-4 h-4 mr-1" /> Click to expand
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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

      {/* Rapid Worker Assignment & Fast Resolution Hub */}
      {userRole === 'admin' ? (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                <span>Specialist Worker Assignment & Fast Resolution</span>
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Assign skilled workers and advance incident resolution in 1 click.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Current Assignee:</span>
              {complaint.assigned_to ? (
                <span className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 shadow-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  {complaint.assigned_to.full_name}
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200">
                  ⚠️ Unassigned
                </span>
              )}
            </div>
          </div>

          {transitionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{transitionError}</span>
            </div>
          )}

          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Quick Worker Select */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-200 shadow-sm">
              <UserPlus className="w-4 h-4 text-indigo-600 shrink-0 ml-1" />
              <select
                value={assigneeId || complaint.assigned_to?.id || ''}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  handleQuickAssign(e.target.value);
                }}
                disabled={assignMutation.isPending}
                className="w-full text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
              >
                <option value="">⚡ Assign Worker / Field Specialist...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Resolution Buttons */}
            <div className="flex items-center gap-2">
              {currentStatus !== 'in_progress' && currentStatus !== 'resolved' && currentStatus !== 'closed' && (
                <button
                  type="button"
                  onClick={handleQuickInProgress}
                  disabled={transitionMutation.isPending}
                  className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Start Work (In Progress)</span>
                </button>
              )}

              {currentStatus !== 'resolved' && currentStatus !== 'closed' && (
                <button
                  type="button"
                  onClick={handleQuickResolve}
                  disabled={transitionMutation.isPending}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Resolved ✓</span>
                </button>
              )}

              {currentStatus === 'resolved' && (
                <button
                  type="button"
                  onClick={() => handleExecuteTransition('closed')}
                  disabled={transitionMutation.isPending}
                  className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Close Ticket 🔒</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Note Input */}
          <div className="flex items-center gap-2 bg-white/90 p-2 rounded-xl border border-indigo-100">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Note (Optional):</span>
            <input
              type="text"
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              placeholder="e.g. Technician replaced hardware components and verified connectivity..."
              className="w-full text-xs text-slate-800 bg-transparent outline-none"
            />
          </div>
        </div>
      ) : (
        /* Employee Actions: Reopen if resolved */
        currentStatus === 'resolved' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-amber-900">Is this incident still not resolved?</h4>
              <p className="text-xs text-amber-700">You can reopen this complaint to have staff review it again.</p>
            </div>
            <button
              type="button"
              onClick={() => handleExecuteTransition('reopened')}
              disabled={transitionMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen Complaint</span>
            </button>
          </div>
        )
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

      {/* Lightbox Modal for Incident Image */}
      {showImageModal && complaint.image_url && (
        <div
          onClick={() => setShowImageModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-bold text-slate-800 truncate">
                Incident Photo Evidence: {complaint.title}
              </span>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[calc(90vh-3rem)] flex items-center justify-center bg-slate-950">
              <img
                src={complaint.image_url}
                alt="Enlarged complaint evidence"
                className="max-h-[80vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

