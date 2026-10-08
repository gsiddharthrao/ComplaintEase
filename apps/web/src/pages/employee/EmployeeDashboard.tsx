import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api-client.js';
import { StatusBadge } from '../../components/complaints/StatusBadge.js';
import { PriorityBadge } from '../../components/complaints/PriorityBadge.js';
import { PlusCircle, Search, Filter, AlertCircle, Clock, ChevronRight, MapPin, Camera, X } from 'lucide-react';
import { LocationMap } from '../../components/common/LocationMap.js';
import { useAuth } from '../../context/AuthContext.js';
import type { ComplaintStatus, ComplaintPriority } from '@complaintease/shared';

export const EmployeeDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | ''>('');
  const [mapModal, setMapModal] = useState<{ lat: number; lng: number; address?: string | null; title: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['complaints', { search, status: statusFilter, priority: priorityFilter }],
    queryFn: () =>
      api.complaints.list({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        limit: 50,
      }),
    refetchInterval: 3000,
  });

  const complaints = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {profile?.role === 'admin' ? 'Plant Incidents & Work Register' : 'My Reported Incidents'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {profile?.role === 'admin'
              ? 'Complete overview of reported plant breakdowns, safety hazards, and field repairs.'
              : 'Track reported equipment breakdowns, safety alarms, and technician progress.'}
          </p>
        </div>

        {profile?.role === 'employee' && (
          <Link
            to="/complaints/new"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-brand-600/20 hover:shadow-brand-600/30 transition-all transform hover:-translate-y-0.5 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Plant Incident</span>
          </Link>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center transition-colors">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search plant incidents by title, keyword, or machinery sector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-brand-500"
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
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-brand-500"
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center transition-colors">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading plant incidents...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-center text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <p className="text-sm font-semibold">Failed to load plant incidents</p>
          <p className="text-xs mt-1">{(error as any)?.message}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center transition-colors">
          <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No plant incidents found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter || priorityFilter
              ? 'Try adjusting your filters or search terms.'
              : 'No incident reports logged yet. Submit a new report to log an equipment breakdown or safety hazard.'}
          </p>
          {profile?.role === 'employee' && (
            <Link
              to="/complaints/new"
              className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-xs font-semibold rounded-xl transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Report a plant incident</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden transition-colors">
          {complaints.map((item) => (
            <Link
              key={item.id}
              to={`/complaints/${item.id}`}
              className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-150 group block"
            >
              <div className="min-w-0 pr-4 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <StatusBadge status={item.status} />
                  <PriorityBadge priority={item.priority} />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    • {item.department?.name || 'General'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    • {item.category?.name || 'Category'}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  {item.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                  <span>Filed {new Date(item.created_at).toLocaleDateString()}</span>
                  {item.assigned_to && (
                    <span>Assigned to: <strong className="text-slate-700 dark:text-slate-300">{item.assigned_to.full_name}</strong></span>
                  )}
                  {item.location_lat != null && item.location_lng != null ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapModal({
                          lat: item.location_lat!,
                          lng: item.location_lng!,
                          address: item.location_address,
                          title: item.title,
                        });
                      }}
                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 transition-colors shadow-xs"
                      title="Click to view live interactive map"
                    >
                      <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{item.location_address || 'View on Map'}</span>
                    </button>
                  ) : item.location_address ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{item.location_address}</span>
                    </span>
                  ) : null}
                  {item.image_url && (
                    <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      <Camera className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Photo Attached</span>
                    </span>
                  )}
                  <span>Version {item.version}</span>
                </div>
              </div>

              {item.image_url && (
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 mr-3 hidden sm:block shadow-sm">
                  <img src={item.image_url} alt="Evidence thumbnail" className="w-full h-full object-cover" />
                </div>
              )}

              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}

      {/* Interactive Map Modal for Employee */}
      {mapModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setMapModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                  Incident Pin Location: {mapModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMapModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-950">
              <LocationMap
                lat={mapModal.lat}
                lng={mapModal.lng}
                address={mapModal.address}
                height="320px"
                title={mapModal.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

