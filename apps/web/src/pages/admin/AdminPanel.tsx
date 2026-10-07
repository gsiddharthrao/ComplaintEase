import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import {
  Building2,
  Tag,
  Users,
  ScrollText,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type { UserRole } from '@complaintease/shared';

export const AdminPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'users' | 'audit'>('departments');

  // Form states
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catDeptId, setCatDeptId] = useState('');

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
          System governance, organizational hierarchy, user role bindings, and immutable audit logs.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 flex flex-wrap">
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
                        <option value="dept_head">Dept Head</option>
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
    </div>
  );
};
