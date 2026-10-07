import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../lib/api-client.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, LogOut, ShieldAlert, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { profile, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(),
    enabled: Boolean(profile),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markSingleReadMutation = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const roleColors: Record<string, string> = {
    employee: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dept_head: 'bg-purple-50 text-purple-700 border-purple-200',
    admin: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Complaint<span className="text-brand-600">Ease</span>
            </span>
          </Link>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-sm text-slate-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-brand-100 text-brand-800 rounded-full font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-xs text-brand-600 hover:text-brand-800 flex items-center space-x-1 font-medium"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.is_read) markSingleReadMutation.mutate(item.id);
                        }}
                        className={`p-3 text-sm cursor-pointer transition-colors ${
                          item.is_read ? 'bg-white hover:bg-slate-50 opacity-70' : 'bg-brand-50/50 hover:bg-brand-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <p className="font-semibold text-slate-900 text-xs">{item.title}</p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User profile & role badge */}
          {profile && (
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-800 leading-tight">
                  {profile.full_name}
                </span>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                    roleColors[profile.role] || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {profile.role.replace('_', ' ')}
                </span>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                <UserIcon className="w-4 h-4" />
              </div>

              <button
                onClick={() => logout()}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
