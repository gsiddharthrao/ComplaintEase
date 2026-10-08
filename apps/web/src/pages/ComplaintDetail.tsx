import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import { useAuth } from '../context/AuthContext.js';
import { StatusBadge } from '../components/complaints/StatusBadge.js';
import { PriorityBadge } from '../components/complaints/PriorityBadge.js';
import { Timeline } from '../components/complaints/Timeline.js';
import { CommentsThread } from '../components/complaints/CommentsThread.js';
import { AttachmentsList } from '../components/complaints/AttachmentsList.js';
import {
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
  Image as ImageIcon,
  Maximize2,
  X,
  Wrench,
  Zap,
  Lock,
} from 'lucide-react';
import { LocationMap } from '../components/common/LocationMap.js';

export const ComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'timeline' | 'comments' | 'attachments'>('timeline');
  const [transitionNote, setTransitionNote] = useState('');
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
    onSuccess: (_data, variables) => {
      setTransitionNote('');
      setTransitionError(null);
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['admin-complaints-feed'] });
      if (variables.new_status === 'closed') {
        navigate(profile?.role === 'admin' ? '/admin?status=closed' : '/employee?status=closed');
      }
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
      queryClient.invalidateQueries({ queryKey: ['admin-complaints-feed'] });
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
      <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-center text-rose-700 dark:text-rose-300">
        <h3 className="font-semibold text-base mb-1 text-rose-900 dark:text-rose-200">Error Loading Complaint</h3>
        <p className="text-xs text-rose-600 dark:text-rose-400">{(error as any)?.message || 'Complaint not found or access denied.'}</p>
        <Link to="/employee" className="mt-4 inline-block text-xs font-semibold text-brand-600 dark:text-brand-400 underline">
          Return to dashboard
        </Link>
      </div>
    );
  }

  // Calculate status and user role
  const currentStatus = complaint.status as ComplaintStatus;
  const userRole = profile?.role || 'employee';

  const handleExecuteTransition = (newStatus: ComplaintStatus) => {
    transitionMutation.mutate({
      new_status: newStatus,
      note: transitionNote || (newStatus === 'closed' ? 'Closed by administrator and archived' : `Status updated to ${newStatus}`),
      expected_version: complaint.version,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button & top meta */}
      <div className="flex items-center justify-between">
        <Link
          to={userRole === 'admin' ? '/admin' : '/employee'}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Incidents</span>
        </Link>

        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
          ID: {complaint.id.slice(0, 8)}... (v{complaint.version})
        </span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <StatusBadge status={currentStatus} />
            <PriorityBadge priority={complaint.priority} />
          </div>

          <div className="text-xs text-slate-400 dark:text-slate-500">
            Filed: {new Date(complaint.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {complaint.title}
        </h1>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          {complaint.description}
        </p>

        {/* Incident Image Evidence & Live Location Cards */}
        {(complaint.image_url || complaint.location_lat || complaint.location_address) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Live Location Card with Interactive OpenStreetMap */}
            {(complaint.location_lat || complaint.location_address) && (
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Live Incident Location Map</span>
                  </div>
                  {complaint.location_address && (
                    <span className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 truncate max-w-[180px]">
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
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-100 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Physical Landmark:</strong> {complaint.location_address}
                  </div>
                )}
              </div>
            )}

            {/* Attached Photo Evidence Card */}
            {complaint.image_url && (
              <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-800 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                    <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Attached Evidence Photo</span>
                  </div>
                  <button
                    onClick={() => setShowImageModal(true)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors shadow-sm"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Enlarge</span>
                  </button>
                </div>

                <div
                  onClick={() => setShowImageModal(true)}
                  className="cursor-pointer group relative overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-800 aspect-video max-h-40 bg-black/5"
                >
                  <img
                    src={complaint.image_url}
                    alt="Complaint evidence"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                    <Maximize2 className="w-4 h-4 mr-1" /> Click to expand
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Department</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{complaint.department?.name || 'General'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Category</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{complaint.category?.name || 'General'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Submitted By</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{complaint.creator?.full_name || 'Staff'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Assigned Worker</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {complaint.assigned_to?.full_name || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rapid Worker Assignment & Fast Resolution Hub */}
      {userRole === 'admin' ? (
        <div className="bg-indigo-50/70 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Specialist Worker Assignment & Fast Resolution</span>
              </h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">
                Assign skilled workers and advance incident resolution in 1 click.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Assignee:</span>
              {complaint.assigned_to ? (
                <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold text-indigo-900 dark:text-indigo-200 shadow-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {complaint.assigned_to.full_name}
                </span>
              ) : (
                <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800">
                  ⚠️ Unassigned
                </span>
              )}
            </div>
          </div>

          {transitionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{transitionError}</span>
            </div>
          )}

          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Quick Worker Select */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 shadow-sm">
              <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
              <select
                value={assigneeId || complaint.assigned_to?.id || ''}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  handleQuickAssign(e.target.value);
                }}
                disabled={assignMutation.isPending}
                className="w-full text-xs font-semibold text-slate-800 dark:text-slate-100 bg-transparent outline-none cursor-pointer"
              >
                <option value="" className="dark:bg-slate-800">⚡ Assign Worker / Field Specialist...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="dark:bg-slate-800">
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Resolution Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Start Work / Under Progress button */}
              {currentStatus !== 'in_progress' && currentStatus !== 'closed' && (
                <button
                  type="button"
                  onClick={handleQuickInProgress}
                  disabled={transitionMutation.isPending}
                  className="flex-1 min-w-[130px] py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{currentStatus === 'resolved' ? 'Resume Work' : '⚡ Under Progress'}</span>
                </button>
              )}

              {/* Mark Resolved button */}
              {currentStatus !== 'resolved' && currentStatus !== 'closed' && (
                <button
                  type="button"
                  onClick={handleQuickResolve}
                  disabled={transitionMutation.isPending}
                  className="flex-1 min-w-[130px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Resolved ✓</span>
                </button>
              )}

              {/* Close Ticket button */}
              {currentStatus !== 'closed' && (
                <button
                  type="button"
                  onClick={() => handleExecuteTransition('closed')}
                  disabled={transitionMutation.isPending}
                  className={`flex-1 min-w-[130px] py-2.5 px-3 text-white text-xs font-bold rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                    currentStatus === 'resolved'
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/25 ring-2 ring-purple-400/50'
                      : 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Close Ticket 🔒</span>
                </button>
              )}

              {/* If ticket is already closed */}
              {currentStatus === 'closed' && (
                <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-100 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>This ticket is closed and archived in the Closed Tickets section.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExecuteTransition('reopened')}
                    disabled={transitionMutation.isPending}
                    className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Ticket</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Note Input */}
          <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Note (Optional):</span>
            <input
              type="text"
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              placeholder="e.g. Technician replaced hardware components and verified connectivity..."
              className="w-full text-xs text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      ) : (
        /* Employee Actions: Reopen if resolved */
        currentStatus === 'resolved' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors">
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Is this incident still not resolved?</h4>
              <p className="text-xs text-amber-700 dark:text-amber-400">You can reopen this complaint to have staff review it again.</p>
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="border-b border-slate-200 dark:border-slate-800 flex overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 min-w-[130px] py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 text-center whitespace-nowrap transition-colors ${
              activeTab === 'timeline'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 bg-brand-50/20 dark:bg-brand-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Timeline & Audit History
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 min-w-[130px] py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 text-center whitespace-nowrap transition-colors ${
              activeTab === 'comments'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 bg-brand-50/20 dark:bg-brand-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Discussion Thread
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`flex-1 min-w-[130px] py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 text-center whitespace-nowrap transition-colors ${
              activeTab === 'attachments'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 bg-brand-50/20 dark:bg-brand-950/20'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Evidence & Attachments
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'timeline' && <Timeline history={complaint.status_history || []} />}
          {activeTab === 'comments' && <CommentsThread complaintId={complaint.id} />}
          {activeTab === 'attachments' && <AttachmentsList complaintId={complaint.id} />}
        </div>
      </div>

      {/* Lightbox Modal for Incident Image */}
      {showImageModal && complaint.image_url && (
        <div
          onClick={() => setShowImageModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
              <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                Incident Photo Evidence: {complaint.title}
              </span>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
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

