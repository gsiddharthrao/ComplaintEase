import React from 'react';
import type { StatusHistory } from '@complaintease/shared';
import { StatusBadge } from './StatusBadge.js';
import { Clock, ArrowRight, User } from 'lucide-react';

interface TimelineProps {
  history: (StatusHistory & { changer?: { full_name: string } })[];
}

export const Timeline: React.FC<TimelineProps> = React.memo(({ history }) => {
  if (!history || history.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No status events recorded yet.</p>;
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((item, idx) => {
          const isLast = idx === history.length - 1;
          return (
            <li key={item.id || idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3 items-start">
                  <div className="h-8 w-8 rounded-full bg-brand-50 border-2 border-brand-500 flex items-center justify-center text-brand-600 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {item.from_status && (
                        <>
                          <StatusBadge status={item.from_status} />
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </>
                      )}
                      <StatusBadge status={item.to_status} />
                      <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                        {new Date(item.created_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{item.changer?.full_name || 'System / Staff'}</span>
                    </div>

                    {item.note && (
                      <div className="mt-2 text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-slate-700 italic">
                        "{item.note}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

Timeline.displayName = 'Timeline';
