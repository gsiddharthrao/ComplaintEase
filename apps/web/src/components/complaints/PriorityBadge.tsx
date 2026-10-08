import React from 'react';
import type { ComplaintPriority } from '@complaintease/shared';

const priorityConfig: Record<ComplaintPriority, { label: string; bg: string; text: string }> = {
  low: { label: 'Low', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
  medium: { label: 'Medium', bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-800 dark:text-blue-300' },
  high: { label: 'High', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300' },
  critical: { label: 'Critical', bg: 'bg-red-100 dark:bg-red-950/60', text: 'text-red-800 dark:text-red-300' },
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

