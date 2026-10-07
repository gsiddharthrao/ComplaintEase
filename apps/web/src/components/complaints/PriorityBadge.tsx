import React from 'react';
import type { ComplaintPriority } from '@complaintease/shared';

const priorityConfig: Record<ComplaintPriority, { label: string; bg: string; text: string }> = {
  low: { label: 'Low', bg: 'bg-slate-100', text: 'text-slate-700' },
  medium: { label: 'Medium', bg: 'bg-blue-100', text: 'text-blue-800' },
  high: { label: 'High', bg: 'bg-amber-100', text: 'text-amber-800' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-800' },
};

export const PriorityBadge: React.FC<{ priority: ComplaintPriority }> = React.memo(({ priority }) => {
  const config = priorityConfig[priority] || priorityConfig.medium;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
});

PriorityBadge.displayName = 'PriorityBadge';
