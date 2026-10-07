import { supabase } from './supabase.js';
import { mockStore, DEMO_PROFILES } from './mock-store.js';
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

function isDemoActive(): boolean {
  return Boolean(localStorage.getItem('complaintease_demo_user'));
}

function getCurrentDemoProfile(): Profile | undefined {
  return mockStore.getCurrentProfile();
}

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
    me: async () => {
      const demo = getCurrentDemoProfile();
      if (demo) {
        return { id: demo.id, email: demo.id, profile: demo };
      }
      try {
        return await fetchWithAuth<{ id: string; email: string; profile: Profile }>('/auth/me');
      } catch (err) {
        const fallback = mockStore.getCurrentProfile() || mockStore.getUserByEmail('employee@demo.com')?.profile;
        if (fallback) {
          return { id: fallback.id, email: 'employee@demo.com', profile: fallback };
        }
        throw err;
      }
    },
    register: async (data: any) => {
      // Register in local persistent store so account can immediately log in locally
      const localResult = mockStore.registerUser(data);
      try {
        await fetchWithAuth<{ id: string; email: string; message: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        // Ignore backend unreachable error in local mode
      }
      return localResult;
    },
  },
  complaints: {
    list: async (params: Record<string, any> = {}) => {
      if (isDemoActive()) {
        return mockStore.listComplaints(params, getCurrentDemoProfile());
      }
      try {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
          }
        });
        const query = searchParams.toString();
        return await fetchWithAuth<ComplaintListResponse>(`/complaints${query ? `?${query}` : ''}`);
      } catch (err) {
        return mockStore.listComplaints(params, getCurrentDemoProfile());
      }
    },
    get: async (id: string) => {
      if (isDemoActive()) {
        return mockStore.getComplaint(id);
      }
      try {
        return await fetchWithAuth<ComplaintWithRelations & { status_history: any[] }>(`/complaints/${id}`);
      } catch (err) {
        return mockStore.getComplaint(id);
      }
    },
    create: async (data: CreateComplaintInput) => {
      if (isDemoActive()) {
        return mockStore.createComplaint(data, getCurrentDemoProfile());
      }
      try {
        return await fetchWithAuth<any>('/complaints', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.createComplaint(data, getCurrentDemoProfile());
      }
    },
    transition: async (id: string, data: TransitionInput) => {
      if (isDemoActive()) {
        return mockStore.transitionComplaint(id, data, getCurrentDemoProfile());
      }
      try {
        return await fetchWithAuth<{ message: string; result: any }>(`/complaints/${id}/transition`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.transitionComplaint(id, data, getCurrentDemoProfile());
      }
    },
    assign: async (id: string, data: AssignInput) => {
      if (isDemoActive()) {
        return mockStore.assignComplaint(id, data, getCurrentDemoProfile());
      }
      try {
        return await fetchWithAuth<any>(`/complaints/${id}/assign`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.assignComplaint(id, data, getCurrentDemoProfile());
      }
    },
  },
  comments: {
    list: async (complaintId: string) => {
      if (isDemoActive()) {
        return mockStore.getComments(complaintId, getCurrentDemoProfile());
      }
      try {
        return await fetchWithAuth<Comment[]>(`/complaints/${complaintId}/comments`);
      } catch (err) {
        return mockStore.getComments(complaintId, getCurrentDemoProfile());
      }
    },
    create: async (complaintId: string, data: CreateCommentInput) => {
      if (isDemoActive()) {
        return mockStore.createComment(complaintId, data, getCurrentDemoProfile());
      }
      try {
        return await fetchWithAuth<Comment>(`/complaints/${complaintId}/comments`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.createComment(complaintId, data, getCurrentDemoProfile());
      }
    },
    delete: async (commentId: string) => {
      if (isDemoActive()) {
        mockStore.deleteComment(commentId);
        return { message: 'Comment deleted' };
      }
      try {
        return await fetchWithAuth<{ message: string }>(`/comments/${commentId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        mockStore.deleteComment(commentId);
        return { message: 'Comment deleted' };
      }
    },
  },
  attachments: {
    list: async (complaintId: string) => {
      if (isDemoActive()) {
        return mockStore.getAttachments(complaintId);
      }
      try {
        return await fetchWithAuth<any[]>(`/complaints/${complaintId}/attachments`);
      } catch (err) {
        return mockStore.getAttachments(complaintId);
      }
    },
    getUploadUrl: async (complaintId: string, data: { file_name: string; file_size: number; mime_type: string }) => {
      try {
        return await fetchWithAuth<{ storage_path: string; upload_url: string; token: string }>(
          `/complaints/${complaintId}/attachments/upload-url`,
          {
            method: 'POST',
            body: JSON.stringify(data),
          },
        );
      } catch (err) {
        return { storage_path: `mock/${data.file_name}`, upload_url: '#', token: 'mock-token' };
      }
    },
    confirm: async (complaintId: string, data: any) => {
      if (isDemoActive()) {
        return mockStore.confirmAttachment(complaintId, data, getCurrentDemoProfile());
      }
      try {
        return await fetchWithAuth<any>(`/complaints/${complaintId}/attachments`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.confirmAttachment(complaintId, data, getCurrentDemoProfile());
      }
    },
  },
  notifications: {
    list: async () => {
      if (isDemoActive()) {
        return mockStore.getNotifications(getCurrentDemoProfile()?.id);
      }
      try {
        return await fetchWithAuth<Notification[]>('/notifications');
      } catch (err) {
        return mockStore.getNotifications(getCurrentDemoProfile()?.id);
      }
    },
    markRead: async (id: string) => {
      if (isDemoActive()) {
        mockStore.markNotificationRead(id);
        return { id, is_read: true } as any;
      }
      try {
        return await fetchWithAuth<Notification>(`/notifications/${id}/read`, {
          method: 'PATCH',
        });
      } catch (err) {
        mockStore.markNotificationRead(id);
        return { id, is_read: true } as any;
      }
    },
    markAllRead: async () => {
      if (isDemoActive()) {
        mockStore.markAllNotificationsRead(getCurrentDemoProfile()?.id);
        return { message: 'All marked read' };
      }
      try {
        return await fetchWithAuth<{ message: string }>('/notifications/read-all', {
          method: 'POST',
        });
      } catch (err) {
        mockStore.markAllNotificationsRead(getCurrentDemoProfile()?.id);
        return { message: 'All marked read' };
      }
    },
  },
  admin: {
    getDepartments: async () => {
      if (isDemoActive()) return mockStore.getDepartments();
      try {
        return await fetchWithAuth<Department[]>('/admin/departments');
      } catch (err) {
        return mockStore.getDepartments();
      }
    },
    createDepartment: async (data: any) => {
      if (isDemoActive()) return mockStore.createDepartment(data);
      try {
        return await fetchWithAuth<Department>('/admin/departments', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.createDepartment(data);
      }
    },
    deleteDepartment: async (id: string) => {
      if (isDemoActive()) {
        mockStore.deleteDepartment(id);
        return { message: 'Department deleted' };
      }
      try {
        return await fetchWithAuth<{ message: string }>(`/admin/departments/${id}`, {
          method: 'DELETE',
        });
      } catch (err) {
        mockStore.deleteDepartment(id);
        return { message: 'Department deleted' };
      }
    },
    getCategories: async () => {
      if (isDemoActive()) return mockStore.getCategories();
      try {
        return await fetchWithAuth<Category[]>('/admin/categories');
      } catch (err) {
        return mockStore.getCategories();
      }
    },
    createCategory: async (data: any) => {
      if (isDemoActive()) return mockStore.createCategory(data);
      try {
        return await fetchWithAuth<Category>('/admin/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.createCategory(data);
      }
    },
    deleteCategory: async (id: string) => {
      if (isDemoActive()) {
        mockStore.deleteCategory(id);
        return { message: 'Category deleted' };
      }
      try {
        return await fetchWithAuth<{ message: string }>(`/admin/categories/${id}`, {
          method: 'DELETE',
        });
      } catch (err) {
        mockStore.deleteCategory(id);
        return { message: 'Category deleted' };
      }
    },
    getUsers: async () => {
      if (isDemoActive()) return mockStore.getUsers();
      try {
        return await fetchWithAuth<Profile[]>('/admin/users');
      } catch (err) {
        return mockStore.getUsers();
      }
    },
    updateUserRole: async (id: string, data: { role: string; department_id?: string | null }) => {
      if (isDemoActive()) return mockStore.updateUserRole(id, data);
      try {
        return await fetchWithAuth<Profile>(`/admin/users/${id}/role`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      } catch (err) {
        return mockStore.updateUserRole(id, data);
      }
    },
    getAuditLogs: async (params: { table_name?: string; offset?: number; limit?: number } = {}) => {
      if (isDemoActive()) return mockStore.getAuditLogs();
      try {
        const searchParams = new URLSearchParams();
        if (params.table_name) searchParams.append('table_name', params.table_name);
        if (params.offset !== undefined) searchParams.append('offset', String(params.offset));
        if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
        return await fetchWithAuth<any[]>(`/admin/audit-logs?${searchParams.toString()}`);
      } catch (err) {
        return mockStore.getAuditLogs();
      }
    },
  },
};
