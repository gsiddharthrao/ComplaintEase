import React from 'react';
import type { ComplaintStatus } from '@complaintease/shared';

const statusConfig: Record<ComplaintStatus, { label: string; bg: string; text: string; border: string }> = {
  submitted: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  under_review: { label: 'Under Review', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  assigned: { label: 'Assigned', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  in_progress: { label: 'In Progress', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  rejected: { label: 'Rejected', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  reopened: { label: 'Reopened', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

export const StatusBadge: React.FC<{ status: ComplaintStatus }> = React.memo(({ status }) => {
  const config = statusConfig[status] || statusConfig.submitted;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-75" />
      {config.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';
