import { supabase } from './supabase.js';
import type {
  ComplaintWithRelations,
  ComplaintListResponse,
  CreateComplaintInput,
  TransitionInput,
  AssignInput,
  CreateCommentInput,
  Comment,
  Notification,
  Department,
  Category,
  Profile,
} from '@complaintease/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const body = await response.json();

  if (!response.ok) {
    const errorMsg = body?.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg) as Error & { code?: string; details?: any };
    err.code = body?.error?.code;
    err.details = body?.error?.details;
    throw err;
  }

  return body.data as T;
}

export const api = {
  auth: {
    me: () => fetchWithAuth<{ id: string; email: string; profile: Profile }>('/auth/me'),
    register: (data: any) =>
      fetchWithAuth<{ id: string; email: string; message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  complaints: {
    list: (params: Record<string, any> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const query = searchParams.toString();
      return fetchWithAuth<ComplaintListResponse>(`/complaints${query ? `?${query}` : ''}`);
    },
    get: (id: string) => fetchWithAuth<ComplaintWithRelations & { status_history: any[] }>(`/complaints/${id}`),
    create: (data: CreateComplaintInput) =>
      fetchWithAuth<any>('/complaints', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    transition: (id: string, data: TransitionInput) =>
      fetchWithAuth<{ message: string; result: any }>(`/complaints/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    assign: (id: string, data: AssignInput) =>
      fetchWithAuth<any>(`/complaints/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  comments: {
    list: (complaintId: string) => fetchWithAuth<Comment[]>(`/complaints/${complaintId}/comments`),
    create: (complaintId: string, data: CreateCommentInput) =>
      fetchWithAuth<Comment>(`/complaints/${complaintId}/comments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (commentId: string) =>
      fetchWithAuth<{ message: string }>(`/comments/${commentId}`, {
        method: 'DELETE',
      }),
  },
  attachments: {
    list: (complaintId: string) => fetchWithAuth<any[]>(`/complaints/${complaintId}/attachments`),
    getUploadUrl: (complaintId: string, data: { file_name: string; file_size: number; mime_type: string }) =>
      fetchWithAuth<{ storage_path: string; upload_url: string; token: string }>(
        `/complaints/${complaintId}/attachments/upload-url`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    confirm: (complaintId: string, data: any) =>
      fetchWithAuth<any>(`/complaints/${complaintId}/attachments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  notifications: {
    list: () => fetchWithAuth<Notification[]>('/notifications'),
    markRead: (id: string) =>
      fetchWithAuth<Notification>(`/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      fetchWithAuth<{ message: string }>('/notifications/read-all', {
        method: 'POST',
      }),
  },
  admin: {
    getDepartments: () => fetchWithAuth<Department[]>('/admin/departments'),
    createDepartment: (data: any) =>
      fetchWithAuth<Department>('/admin/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteDepartment: (id: string) =>
      fetchWithAuth<{ message: string }>(`/admin/departments/${id}`, {
        method: 'DELETE',
      }),
    getCategories: () => fetchWithAuth<Category[]>('/admin/categories'),
    createCategory: (data: any) =>
      fetchWithAuth<Category>('/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteCategory: (id: string) =>
      fetchWithAuth<{ message: string }>(`/admin/categories/${id}`, {
        method: 'DELETE',
      }),
    getUsers: () => fetchWithAuth<Profile[]>('/admin/users'),
    updateUserRole: (id: string, data: { role: string; department_id?: string | null }) =>
      fetchWithAuth<Profile>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getAuditLogs: (params: { table_name?: string; offset?: number; limit?: number } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.table_name) searchParams.append('table_name', params.table_name);
      if (params.offset !== undefined) searchParams.append('offset', String(params.offset));
      if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
      return fetchWithAuth<any[]>(`/admin/audit-logs?${searchParams.toString()}`);
    },
  },
};
