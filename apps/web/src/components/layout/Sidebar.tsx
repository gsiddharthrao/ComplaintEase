import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  FileText,
  PlusCircle,
  Kanban,
  Settings,
  Building2,
  Users,
  Shield,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { profile } = useAuth();
  if (!profile) return null;

  const role = profile.role;

  const navItems = [
    ...(role === 'employee'
      ? [
          { to: '/employee', label: 'My Reported Incidents', icon: FileText },
          { to: '/complaints/new', label: 'Report Plant Issue', icon: PlusCircle },
        ]
      : []),
    ...(role === 'admin'
      ? [
          { to: '/admin', label: 'Admin Command Center', icon: Settings },
          { to: '/employee', label: 'All Plant Incidents', icon: FileText },
        ]
      : []),
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] transition-colors duration-200">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Role Summary info at bottom */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 m-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
        <div className="flex items-center space-x-2.5 text-xs text-slate-600 dark:text-slate-300">
          <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold text-slate-800 dark:text-slate-100 capitalize">{role.replace('_', ' ')}</span>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">RLS Protected Workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

