import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  FileText,
  PlusCircle,
  Settings,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { profile } = useAuth();

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

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

  const renderNavContent = (isMobile = false) => (
    <>
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
              onClick={() => {
                if (isMobile && onCloseMobile) {
                  onCloseMobile();
                }
              }}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
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
    </>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar — Locked to layout height, never scrolls away */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col justify-between shrink-0 h-full overflow-y-auto sticky top-0 transition-colors duration-200 select-none">
        {renderNavContent(false)}
      </aside>

      {/* 2. Mobile Responsive Drawer — Slides in when mobile menu is tapped */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            <div>
              {/* Drawer Header with Close Button */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold shadow-sm">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Complaint<span className="text-brand-500">Ease</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              {renderNavContent(true)}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
