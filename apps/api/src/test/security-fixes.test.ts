import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Define mock user and supabase instance
let currentMockUser = { id: 'user-123', email: 'test@example.com' };
let currentMockProfile: { id: string; full_name: string; role: 'admin' | 'employee' } = { id: 'user-123', full_name: 'Test Admin', role: 'admin' };
let mockComplaintLookup: any = { data: { id: 'complaint-abc' }, error: null };
let mockInsertResult: any = { data: { id: 'att-1', file_name: 'test.png' }, error: null };
let mockUpdateResult: any = { data: { id: 'target-user', role: 'employee' }, error: null };

const mockSupabase = {
  from: (table: string) => ({
    select: (_fields?: string) => ({
      eq: (_field: string, val: any) => ({
        single: () => {
          if (table === 'complaints') {
            return mockComplaintLookup;
          }
          return { data: { id: val }, error: null };
        },
      }),
      order: () => ({ data: [], error: null }),
    }),
    insert: (_payload: any) => ({
      select: () => ({
        single: () => mockInsertResult,
      }),
    }),
    update: (_payload: any) => ({
      eq: (_field: string, _val: any) => ({
        select: () => ({
          single: () => mockUpdateResult,
        }),
      }),
    }),
  }),
  storage: {
    from: () => ({
      createSignedUploadUrl: () => ({ data: { signedUrl: 'http://upload', token: 'tok' }, error: null }),
      createSignedUrl: () => ({ data: { signedUrl: 'http://download' }, error: null }),
    }),
  },
};

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.id = 'req-test-123';
    req.user = currentMockUser;
    req.profile = currentMockProfile;
    req.supabase = mockSupabase;
    next();
  },
  requireRole: (allowedRoles: string[]) => (req: any, res: any, next: any) => {
    if (allowedRoles.includes(req.profile?.role)) {
      return next();
    }
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  },
}));

// Import routers after mock definition
const { attachmentsRouter } = await import('../routes/attachments.js');
const { adminRouter } = await import('../routes/admin.js');
const { errorHandler } = await import('../middleware/error-handler.js');

const app = express();
app.use(express.json());
app.use('/api/v1', attachmentsRouter);
app.use('/api/v1', adminRouter);
app.use(errorHandler);

describe('Security Fix Regression Tests', () => {
  beforeEach(() => {
    currentMockUser = { id: 'user-123', email: 'test@example.com' };
    currentMockProfile = { id: 'user-123', full_name: 'Test Admin', role: 'admin' };
    mockComplaintLookup = { data: { id: 'complaint-abc' }, error: null };
  });

  describe('Attachment storage_path BOLA / IDOR Protection', () => {
    it('rejects confirmation when storage_path belongs to another user (BOLA)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/complaint-abc/attachments')
        .send({
          file_name: 'secret.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          storage_path: 'victim-user-456/complaint-abc/uuid-file.pdf',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Storage path does not belong to the authenticated user');
    });

    it('rejects confirmation when storage_path targets a different complaint ID', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/complaint-abc/attachments')
        .send({
          file_name: 'doc.pdf',
          file_size: 2048,
          mime_type: 'application/pdf',
          storage_path: 'user-123/other-complaint-xyz/uuid-file.pdf',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects confirmation with path traversal in storage_path', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/complaint-abc/attachments')
        .send({
          file_name: 'hack.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          storage_path: 'user-123/complaint-abc/../../etc/passwd.pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STORAGE_PATH');
    });

    it('rejects confirmation when complaint is inaccessible or not found', async () => {
      mockComplaintLookup = { data: null, error: { message: 'Not found' } };

      const res = await request(app)
        .post('/api/v1/complaints/non-existent-comp/attachments')
        .send({
          file_name: 'valid.png',
          file_size: 512,
          mime_type: 'image/png',
          storage_path: 'user-123/non-existent-comp/valid-uuid.png',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('successfully accepts legitimate storage_path matching caller and complaint', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/complaint-abc/attachments')
        .send({
          file_name: 'photo.jpg',
          file_size: 20480,
          mime_type: 'image/jpeg',
          storage_path: 'user-123/complaint-abc/99999999-9999-9999-9999-999999999999.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('Admin Self-Demotion Prevention', () => {
    it('blocks an administrator from demoting their own role to employee', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/user-123/role')
        .send({
          role: 'employee',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_DEMOTE_SELF');
      expect(res.body.error.message).toContain('Administrators cannot demote their own account');
    });

    it('allows an administrator to change another user role', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/other-user-789/role')
        .send({
          role: 'employee',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('allows an administrator to reaffirm own admin status or update department', async () => {
      mockUpdateResult = { data: { id: 'user-123', role: 'admin', department_id: 'dept-1' }, error: null };

      const res = await request(app)
        .patch('/api/v1/admin/users/user-123/role')
        .send({
          role: 'admin',
          department_id: '11111111-1111-1111-1111-111111111111',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('Department and Category Access Control', () => {
    it('allows an employee to read departments and categories', async () => {
      currentMockProfile = { id: 'user-123', full_name: 'Test Employee', role: 'employee' };

      const resDept = await request(app).get('/api/v1/admin/departments');
      expect(resDept.status).toBe(200);
      expect(resDept.body).toHaveProperty('data');

      const resCat = await request(app).get('/api/v1/admin/categories');
      expect(resCat.status).toBe(200);
      expect(resCat.body).toHaveProperty('data');
    });

    it('forbids an employee from creating or modifying departments and categories', async () => {
      currentMockProfile = { id: 'user-123', full_name: 'Test Employee', role: 'employee' };

      const resCreateDept = await request(app)
        .post('/api/v1/admin/departments')
        .send({ name: 'Unauthorized Dept' });
      expect(resCreateDept.status).toBe(403);
      expect(resCreateDept.body.error.code).toBe('FORBIDDEN');

      const resCreateCat = await request(app)
        .post('/api/v1/admin/categories')
        .send({ name: 'Unauthorized Cat' });
      expect(resCreateCat.status).toBe(403);
      expect(resCreateCat.body.error.code).toBe('FORBIDDEN');
    });
  });
});

