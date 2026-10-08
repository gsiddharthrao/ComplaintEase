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
    let errorMsg = body?.error?.message || `Request failed with status ${response.status}`;
    if (body?.error?.details && Array.isArray(body.error.details) && body.error.details.length > 0) {
      const detailedMessages = body.error.details
        .map((d: any) => {
          if (typeof d === 'string') return d;
          if (d?.message) return `${d.path ? d.path + ': ' : ''}${d.message}`;
          return null;
        })
        .filter(Boolean)
        .join('. ');
      if (detailedMessages) {
        errorMsg = detailedMessages;
      }
    }
    const err = new Error(errorMsg) as Error & { code?: string; details?: any };
    err.code = body?.error?.code;
    err.details = body?.error?.details;
    throw err;
  }

  if (body && typeof body === 'object') {
    // If response body contains pagination metadata (e.g. ComplaintListResponse with next_cursor / total_count),
    // return the full envelope so callers can access both data array and pagination metadata.
    if ('data' in body && ('next_cursor' in body || 'total_count' in body)) {
      return body as T;
    }
    if ('data' in body) {
      return body.data as T;
    }
  }

  return body as T;
}

export const api = {
  auth: {
    me: async () => {
      return await fetchWithAuth<{ id: string; email: string; profile: Profile }>('/auth/me');
    },
    register: async (data: any) => {
      return await fetchWithAuth<{ id: string; email: string; message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
  departments: {
    list: async () => {
      return await fetchWithAuth<Department[]>('/departments');
    },
  },
  categories: {
    list: async () => {
      return await fetchWithAuth<Category[]>('/categories');
    },
  },
  complaints: {
    list: async (params: Record<string, any> = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const query = searchParams.toString();
      return await fetchWithAuth<ComplaintListResponse>(`/complaints${query ? `?${query}` : ''}`);
    },
    get: async (id: string) => {
      return await fetchWithAuth<ComplaintWithRelations & { status_history: any[] }>(`/complaints/${id}`);
    },
    create: async (data: CreateComplaintInput) => {
      return await fetchWithAuth<any>('/complaints', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    transition: async (id: string, data: TransitionInput) => {
      return await fetchWithAuth<{ message: string; result: any }>(`/complaints/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    assign: async (id: string, data: AssignInput) => {
      return await fetchWithAuth<any>(`/complaints/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
  comments: {
    list: async (complaintId: string) => {
      return await fetchWithAuth<Comment[]>(`/complaints/${complaintId}/comments`);
    },
    create: async (complaintId: string, data: CreateCommentInput) => {
      return await fetchWithAuth<Comment>(`/complaints/${complaintId}/comments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    delete: async (commentId: string) => {
      return await fetchWithAuth<{ message: string }>(`/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
  },
  attachments: {
    list: async (complaintId: string) => {
      return await fetchWithAuth<any[]>(`/complaints/${complaintId}/attachments`);
    },
    getUploadUrl: async (complaintId: string, data: { file_name: string; file_size: number; mime_type: string }) => {
      return await fetchWithAuth<{ storage_path: string; upload_url: string; token: string }>(
        `/complaints/${complaintId}/attachments/upload-url`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    },
    confirm: async (complaintId: string, data: any) => {
      return await fetchWithAuth<any>(`/complaints/${complaintId}/attachments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
  notifications: {
    list: async () => {
      return await fetchWithAuth<Notification[]>('/notifications');
    },
    markRead: async (id: string) => {
      return await fetchWithAuth<Notification>(`/notifications/${id}/read`, {
        method: 'PATCH',
      });
    },
    markAllRead: async () => {
      return await fetchWithAuth<{ message: string }>('/notifications/read-all', {
        method: 'POST',
      });
    },
  },
  admin: {
    getDepartments: async () => {
      return await fetchWithAuth<Department[]>('/admin/departments');
    },
    createDepartment: async (data: any) => {
      return await fetchWithAuth<Department>('/admin/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    deleteDepartment: async (id: string) => {
      return await fetchWithAuth<{ message: string }>(`/admin/departments/${id}`, {
        method: 'DELETE',
      });
    },
    getCategories: async () => {
      return await fetchWithAuth<Category[]>('/admin/categories');
    },
    createCategory: async (data: any) => {
      return await fetchWithAuth<Category>('/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    deleteCategory: async (id: string) => {
      return await fetchWithAuth<{ message: string }>(`/admin/categories/${id}`, {
        method: 'DELETE',
      });
    },
    getUsers: async () => {
      return await fetchWithAuth<Profile[]>('/admin/users');
    },
    updateUserRole: async (id: string, data: { role: string; department_id?: string | null }) => {
      return await fetchWithAuth<Profile>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    getAuditLogs: async (params: { table_name?: string; offset?: number; limit?: number } = {}) => {
      const searchParams = new URLSearchParams();
      if (params.table_name) searchParams.append('table_name', params.table_name);
      if (params.offset !== undefined) searchParams.append('offset', String(params.offset));
      if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
      return await fetchWithAuth<any[]>(`/admin/audit-logs?${searchParams.toString()}`);
    },
  },
};
