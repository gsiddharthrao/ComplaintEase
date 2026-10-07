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
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 m-3 rounded-xl border">
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <Shield className="w-4 h-4 text-brand-600 shrink-0" />
          <div className="truncate">
            <span className="font-semibold text-slate-800 capitalize">{role.replace('_', ' ')}</span>
            <p className="text-[11px] text-slate-400 truncate">RLS Bound Context</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

