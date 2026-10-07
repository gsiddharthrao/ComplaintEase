import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { StatusBadge } from '../../components/complaints/StatusBadge.js';
import { PriorityBadge } from '../../components/complaints/PriorityBadge.js';
import {
  Building2,
  Tag,
  Users,
  ScrollText,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  MapPin,
  Camera,
  ExternalLink,
  Maximize2,
  X,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  FileText,
  Wrench,
  Zap,
} from 'lucide-react';
import { LocationMap } from '../../components/common/LocationMap.js';
import type { UserRole, ComplaintStatus } from '@complaintease/shared';

export const AdminPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'complaints' | 'departments' | 'categories' | 'users' | 'audit'>('complaints');

  // Complaints feed state
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Form states
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catDeptId, setCatDeptId] = useState('');

  // 0. Live complaints query
  const { data: complaintsData, isLoading: complaintsLoading } = useQuery({
    queryKey: ['admin-complaints-feed'],
    queryFn: () => api.complaints.list({ limit: 100 }),
  });
  const allComplaints = complaintsData?.data || [];

  const filteredComplaints = allComplaints.filter((c) => {
    if (complaintStatusFilter && c.status !== complaintStatusFilter) return false;
    if (complaintSearch) {
      const q = complaintSearch.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      const matchLoc = (c.location_address || '').toLowerCase().includes(q);
      const matchCreator = (c.creator?.full_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc && !matchCreator) return false;
    }
    return true;
  });

  // 1. Departments query & mutations
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => api.admin.getDepartments(),
  });

  const createDeptMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => api.admin.createDepartment(data),
    onSuccess: () => {
      setDeptName('');
      setDeptDesc('');
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteDepartment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-departments'] }),
  });

  // 2. Categories query & mutations
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.admin.getCategories(),
  });

  const createCatMutation = useMutation({
    mutationFn: (data: { name: string; description: string; department_id: string | null }) =>
      api.admin.createCategory(data),
    onSuccess: () => {
      setCatName('');
      setCatDesc('');
      setCatDeptId('');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
  });

  // 3. Users query & mutations
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.admin.getUsers(),
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ id, role, department_id }: { id: string; role: UserRole; department_id?: string | null }) =>
      api.admin.updateUserRole(id, { role, department_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  // Fast direct worker assignment
  const quickAssignMutation = useMutation({
    mutationFn: ({ complaintId, workerId }: { complaintId: string; workerId: string }) =>
      api.complaints.assign(complaintId, { assigned_to: workerId, note: 'Quick-assigned by administrator' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints-feed'] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
  });

  // Fast direct status transition
  const quickTransitionMutation = useMutation({
    mutationFn: ({ complaintId, newStatus, version }: { complaintId: string; newStatus: ComplaintStatus; version: number }) =>
      api.complaints.transition(complaintId, {
        new_status: newStatus,
        note: `Status updated to ${newStatus} by administrator`,
        expected_version: version,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints-feed'] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
  });

  // 4. Audit logs query
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.admin.getAuditLogs({ limit: 50 }),
    enabled: activeTab === 'audit',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
          Enterprise Administration Control
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Live incident oversight, GPS geotag feeds, department management, and immutable audit logs.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 flex flex-wrap">
          <button
            onClick={() => setActiveTab('complaints')}
            className={`flex items-center space-x-2 py-3 px-6 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'complaints'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Incidents & Geotag Feed ({allComplaints.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center space-x-2 py-3 px-6 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'departments'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center space-x-2 py-3 px-6 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 py-3 px-6 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Roles ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center space-x-2 py-3 px-6 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-brand-600 text-brand-600 bg-brand-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span>Immutable Audit Trail</span>
          </button>
        </div>

        <div className="p-6">
          {/* 0. LIVE COMPLAINTS & GEOTAG FEED */}
          {activeTab === 'complaints' && (
            <div className="space-y-6">
              {/* Filter / Search Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search incidents by title, description, address, or reporter..."
                    value={complaintSearch}
                    onChange={(e) => setComplaintSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={complaintStatusFilter}
                      onChange={(e) => setComplaintStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white outline-none"
                    >
                      <option value="">All Statuses ({allComplaints.length})</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                      <option value="rejected">Rejected</option>
                      <option value="reopened">Reopened</option>
                    </select>
                  </div>

                  <span className="text-xs text-slate-500 shrink-0">
                    Showing <strong>{filteredComplaints.length}</strong> incidents
                  </span>
                </div>
              </div>

              {/* Feed List */}
              {complaintsLoading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Loading live incident feed...</p>
                </div>
              ) : filteredComplaints.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-700">No incident complaints found</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Try relaxing the search keyword or status filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredComplaints.map((c) => {
                    const hasLocation = c.location_lat != null || !!c.location_address;
                    const hasImage = !!c.image_url;

                    return (
                      <div
                        key={c.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow relative space-y-4"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                          {/* Left Column: Complaint Details & Map */}
                          <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={c.status} />
                              <PriorityBadge priority={c.priority} />
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                {c.department?.name || 'Department'}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {c.category?.name || 'General'}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(c.created_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>

                            <div>
                              <Link
                                to={`/complaints/${c.id}`}
                                className="text-base font-bold text-slate-900 hover:text-brand-600 transition-colors inline-flex items-center gap-1.5"
                              >
                                <span>{c.title}</span>
                                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
                              </Link>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {c.description}
                              </p>
                            </div>

                            {/* Sub-meta: Reporter & Assignee */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                Reporter:{' '}
                                <strong className="text-slate-700">
                                  {c.creator?.full_name || 'Anonymous Employee'}
                                </strong>
                              </span>
                              {c.assigned_to ? (
                                <span className="flex items-center gap-1.5 text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                  <Wrench className="w-3 h-3 text-indigo-600" />
                                  Assigned: {c.assigned_to.full_name}
                                </span>
                              ) : (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold text-[11px]">
                                  ⚠️ Unassigned
                                </span>
                              )}
                              <span className="text-slate-400 text-[11px] ml-auto">
                                v{c.version} • {c.comment_count || 0} comments
                              </span>
                            </div>

                            {/* Live Interactive Location Map */}
                            {c.location_lat != null && c.location_lng != null && (
                              <div className="pt-1">
                                <LocationMap
                                  lat={c.location_lat}
                                  lng={c.location_lng}
                                  address={c.location_address}
                                  height="180px"
                                  title={`Map location for ${c.title}`}
                                />
                              </div>
                            )}
                          </div>

                          {/* Right Column: Photo Evidence */}
                          <div className="flex flex-col gap-3 lg:w-72 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-4">
                            {/* Photo Evidence Card */}
                            {hasImage ? (
                              <div className="flex flex-col gap-2 p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                                  <span className="flex items-center gap-1">
                                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                                    Photo Evidence
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxImage({
                                        url: c.image_url!,
                                        title: c.title,
                                      })
                                    }
                                    className="text-[11px] text-blue-700 hover:text-blue-900 underline font-medium"
                                  >
                                    Enlarge
                                  </button>
                                </div>
                                <div
                                  onClick={() =>
                                    setLightboxImage({
                                      url: c.image_url!,
                                      title: c.title,
                                    })
                                  }
                                  className="relative w-full h-32 rounded-lg overflow-hidden border border-blue-300 cursor-pointer group"
                                  title="Click to enlarge photo"
                                >
                                  <img
                                    src={c.image_url!}
                                    alt="Plant Incident Evidence"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Maximize2 className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-400 flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-slate-300" />
                                <span>No photo attached</span>
                              </div>
                            )}

                            {/* Physical Landmark note if no GPS */}
                            {c.location_lat == null && c.location_address && (
                              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                                <span className="font-bold block text-[10px] uppercase text-emerald-700">Landmark</span>
                                {c.location_address}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RAPID WORKER ASSIGNMENT & 1-CLICK RESOLUTION BAR */}
                        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
                          {/* Quick Worker Assignment Dropdown */}
                          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                            <Wrench className="w-4 h-4 text-indigo-600 shrink-0" />
                            <select
                              value={c.assigned_to?.id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) quickAssignMutation.mutate({ complaintId: c.id, workerId: val });
                              }}
                              disabled={quickAssignMutation.isPending}
                              className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-brand-500 shadow-sm transition-colors"
                            >
                              <option value="">
                                ⚡ {c.assigned_to ? `Assigned: ${c.assigned_to.full_name} (Reassign ▾)` : 'Assign Specialist / Technician...'}
                              </option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.full_name} ({u.role})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quick 1-Click Status Progression Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {c.status !== 'in_progress' && c.status !== 'resolved' && c.status !== 'closed' && (
                              <button
                                type="button"
                                onClick={() =>
                                  quickTransitionMutation.mutate({
                                    complaintId: c.id,
                                    newStatus: 'in_progress',
                                    version: c.version,
                                  })
                                }
                                disabled={quickTransitionMutation.isPending}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                title="Move status to In Progress"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Start Work</span>
                              </button>
                            )}

                            {c.status !== 'resolved' && c.status !== 'closed' && (
                              <button
                                type="button"
                                onClick={() =>
                                  quickTransitionMutation.mutate({
                                    complaintId: c.id,
                                    newStatus: 'resolved',
                                    version: c.version,
                                  })
                                }
                                disabled={quickTransitionMutation.isPending}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                title="Mark as Resolved"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Resolve ✓</span>
                              </button>
                            )}

                            {c.status === 'resolved' && (
                              <button
                                type="button"
                                onClick={() =>
                                  quickTransitionMutation.mutate({
                                    complaintId: c.id,
                                    newStatus: 'closed',
                                    version: c.version,
                                  })
                                }
                                disabled={quickTransitionMutation.isPending}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                              >
                                <span>Close 🔒</span>
                              </button>
                            )}

                            <Link
                              to={`/complaints/${c.id}`}
                              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                            >
                              <span>Full View</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 1. DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!deptName.trim()) return;
                  createDeptMutation.mutate({ name: deptName.trim(), description: deptDesc.trim() });
                }}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-end"
              >
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Legal & Compliance"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    placeholder="Contract review & regulatory audit"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createDeptMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-lg flex items-center space-x-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Department</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {departments.map((d) => (
                  <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{d.name}</h4>
                      <p className="text-xs text-slate-500">{d.description || 'No description'}</p>
                    </div>
                    <button
                      onClick={() => deleteDeptMutation.mutate(d.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete department"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!catName.trim()) return;
                  createCatMutation.mutate({
                    name: catName.trim(),
                    description: catDesc.trim(),
                    department_id: catDeptId || null,
                  });
                }}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Server Incident"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Department (Optional)
                  </label>
                  <select
                    value={catDeptId}
                    onChange={(e) => setCatDeptId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                  >
                    <option value="">Global (All Departments)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={createCatMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {categories.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                      <p className="text-xs text-slate-500">
                        {(c as any).department ? `Department: ${(c as any).department.name}` : 'Global Category'}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCatMutation.mutate(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {users.map((u) => (
                  <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{u.full_name}</h4>
                      <p className="text-xs text-slate-400 font-mono">User ID: {u.id.slice(0, 8)}...</p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateUserRoleMutation.mutate({
                            id: u.id,
                            role: e.target.value as UserRole,
                            department_id: u.department_id,
                          })
                        }
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">System Admin</option>
                      </select>

                      <select
                        value={u.department_id || ''}
                        onChange={(e) =>
                          updateUserRoleMutation.mutate({
                            id: u.id,
                            role: u.role,
                            department_id: e.target.value || null,
                          })
                        }
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white outline-none"
                      >
                        <option value="">No Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                🔒 <strong>Append-Only Security Guarantee:</strong> All rows below were recorded via database triggers. Database triggers prevent any UPDATE or DELETE operations on this table (SQLSTATE 55000).
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Table</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Changes (JSON Diff)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              log.action === 'INSERT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action === 'UPDATE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{log.table_name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.actor_profile?.full_name || log.actor?.slice(0, 8) || 'System'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate text-[11px]">
                          {JSON.stringify(log.new_data || log.old_data || {})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Photo Evidence */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-800 truncate max-w-md">
                  Evidence Photo: {lightboxImage.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow"
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
