import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentMockUser = { id: 'admin-123', email: 'admin@example.com' };
let currentMockProfile = { id: 'admin-123', full_name: 'Admin User', role: 'admin' as const };
let mockComplaintData: any = { id: 'comp-100', version: 6, status: 'submitted' };
let mockRpcCalls: { fn: string; args: any }[] = [];
let mockInsertCalls: { table: string; payload: any }[] = [];

const mockSupabase = {
  from: (table: string) => ({
    select: (_fields?: string) => ({
      eq: (_field: string, _val: any) => ({
        single: () => ({ data: mockComplaintData, error: null }),
      }),
      order: () => ({ data: [], error: null }),
    }),
    insert: (payload: any) => {
      mockInsertCalls.push({ table, payload });
      return {
        select: () => ({
          single: () => ({ data: { id: 'new-comp-1', ...payload }, error: null }),
        }),
      };
    },
    update: (_payload: any) => ({
      eq: () => ({
        select: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
  rpc: (fn: string, args: any) => {
    mockRpcCalls.push({ fn, args });

    if (fn === 'transition_complaint') {
      // Simulate optimistic concurrency check:
      // If client sends stale version (e.g. 5) while complaint is at version 6
      if (args.p_expected_version !== 6) {
        const conflictErr = Object.assign(
          new Error(`Conflict: expected version ${args.p_expected_version}, but current version is 6`),
          { code: 'P0003' },
        );
        return { data: null, error: conflictErr };
      }

      return {
        data: {
          success: true,
          complaint_id: args.p_complaint_id,
          to_status: args.p_new_status,
          new_version: 7,
        },
        error: null,
      };
    }

    if (fn === 'assign_specialist') {
      return {
        data: {
          success: true,
          assignment_id: 'assign-uuid-999',
          complaint_id: args.p_complaint_id,
          assigned_to: args.p_assigned_to,
          status: 'assigned',
          version: 2,
        },
        error: null,
      };
    }

    return { data: null, error: null };
  },
};

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.id = 'req-occ-test';
    req.user = currentMockUser;
    req.profile = currentMockProfile;
    req.supabase = mockSupabase;
    next();
  },
  requireRole: (allowedRoles: string[]) => (req: any, res: any, next: any) => {
    if (allowedRoles.includes(req.profile?.role)) {
      return next();
    }
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
  },
}));

// Mock utils/supabase getAdminClient to verify it is NOT called during complaint creation
const mockAdminInsert = vi.fn();
vi.mock('../utils/supabase.js', () => ({
  getAdminClient: () => ({
    from: () => ({
      insert: mockAdminInsert,
    }),
  }),
}));

const { complaintsRouter } = await import('../routes/complaints.js');
const { errorHandler } = await import('../middleware/error-handler.js');

const app = express();
app.use(express.json());
app.use('/api/v1', complaintsRouter);
app.use(errorHandler);

describe('Optimistic Concurrency & Atomic RPC Integration Tests (R4.1, R3.2, R2.4)', () => {
  beforeEach(() => {
    mockRpcCalls = [];
    mockInsertCalls = [];
    mockAdminInsert.mockClear();
    currentMockUser = { id: 'admin-123', email: 'admin@example.com' };
    currentMockProfile = { id: 'admin-123', full_name: 'Admin User', role: 'admin' };
    mockComplaintData = { id: 'comp-100', version: 6, status: 'submitted' };
  });

  describe('Optimistic Concurrency Control (OCC)', () => {
    it('returns HTTP 409 Conflict when client sends stale expected_version (v5 vs DB v6)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-100/transition')
        .send({
          new_status: 'under_review',
          expected_version: 5, // Stale! Current DB version is 6
          note: 'Transitioning with stale version',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
      expect(res.body.error.message).toContain('updated by another user');

      // Verify that transition_complaint was invoked with client's expected_version 5 directly
      expect(mockRpcCalls.length).toBe(1);
      expect(mockRpcCalls[0].fn).toBe('transition_complaint');
      expect(mockRpcCalls[0].args.p_expected_version).toBe(5);
    });

    it('succeeds with HTTP 200 when client sends matching expected_version (v6 vs DB v6)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-100/transition')
        .send({
          new_status: 'under_review',
          expected_version: 6, // Matching current version
          note: 'Valid transition',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Status transition completed successfully');
      expect(mockRpcCalls[0].args.p_expected_version).toBe(6);
    });
  });

  describe('Atomic Specialist Assignment (assign_specialist RPC)', () => {
    it('executes atomic assign_specialist RPC with complaint ID and assignee', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-100/assign')
        .send({
          assigned_to: '11111111-2222-3333-4444-555555555555',
          note: 'Urgent machinery assignment',
          expected_version: 6,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('assignment_id');
      expect(res.body.data.status).toBe('assigned');

      expect(mockRpcCalls.length).toBe(1);
      expect(mockRpcCalls[0].fn).toBe('assign_specialist');
      expect(mockRpcCalls[0].args.p_complaint_id).toBe('comp-100');
      expect(mockRpcCalls[0].args.p_assigned_to).toBe('11111111-2222-3333-4444-555555555555');
      expect(mockRpcCalls[0].args.p_expected_version).toBe(6);
    });

    it('blocks non-admin users from assigning specialists', async () => {
      currentMockProfile = { id: 'emp-123', full_name: 'Employee', role: 'employee' as any };

      const res = await request(app)
        .post('/api/v1/complaints/comp-100/assign')
        .send({
          assigned_to: '11111111-2222-3333-4444-555555555555',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(mockRpcCalls.length).toBe(0);
    });
  });

  describe('Complaint Creation without Service-Role Key Bypass', () => {
    it('creates complaint without calling getAdminClient() for status_history', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .send({
          title: 'Damaged Hydraulic Pipe',
          description: 'High pressure line leakage in assembly plant section 3B',
          priority: 'critical',
          department_id: '11111111-1111-1111-1111-111111111111',
          category_id: '22222222-2222-2222-2222-222222222222',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');

      // Verified: getAdminClient().from('status_history').insert was NOT called
      expect(mockAdminInsert).not.toHaveBeenCalled();

      // Verified: complaint was inserted into complaints table via user's authenticated client
      const complaintInsert = mockInsertCalls.find((c) => c.table === 'complaints');
      expect(complaintInsert).toBeDefined();
      expect(complaintInsert?.payload.status).toBe('submitted');
      expect(complaintInsert?.payload.created_by).toBe('admin-123');
    });
  });
});
