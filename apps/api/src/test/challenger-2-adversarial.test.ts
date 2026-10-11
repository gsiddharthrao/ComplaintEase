import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  ComplaintStatus,
} from '@complaintease/shared';
import { ALLOWED_MIME_TYPES } from '../routes/attachments.js';

// =============================================================================
// Challenger 2: Adversarial Stress Test Suite
// Focus:
// 1. Terminal State Invariants (closed, rejected)
// 2. Employee Role Restrictions (reopen own only, blocked on others / other states)
// 3. Storage MIME Whitelist Stress & Boundary Fuzzing
// 4. Storage Path Traversal Prevention
// 5. Cross-User Storage Access (IDOR / BOLA)
// =============================================================================

let currentMockUser = { id: 'emp-user-1', email: 'emp1@example.com' };
let currentMockProfile: { id: string; full_name: string; role: 'admin' | 'employee' } = {
  id: 'emp-user-1',
  full_name: 'Employee One',
  role: 'employee',
};

// Mock database storage for complaints
let mockComplaintsTable: Record<string, { id: string; created_by: string; status: ComplaintStatus; version: number }> = {
  'comp-emp-1': { id: 'comp-emp-1', created_by: 'emp-user-1', status: 'resolved', version: 3 },
  'comp-emp-2': { id: 'comp-emp-2', created_by: 'emp-user-2', status: 'resolved', version: 3 },
  'comp-closed': { id: 'comp-closed', created_by: 'emp-user-1', status: 'closed', version: 4 },
  'comp-rejected': { id: 'comp-rejected', created_by: 'emp-user-1', status: 'rejected', version: 2 },
  'comp-submitted': { id: 'comp-submitted', created_by: 'emp-user-1', status: 'submitted', version: 1 },
};

let mockAttachmentsTable: any[] = [];
let mockRpcCalls: { fn: string; args: any }[] = [];

const mockSupabase = {
  from: (table: string) => ({
    select: (_fields?: string) => ({
      eq: (_field: string, val: any) => ({
        single: () => {
          if (table === 'complaints') {
            const complaint = mockComplaintsTable[val];
            if (!complaint) {
              return { data: null, error: { message: 'Complaint not found' } };
            }
            // Simulate RLS: employee can only see their own complaints
            if (currentMockProfile.role === 'employee' && complaint.created_by !== currentMockUser.id) {
              return { data: null, error: { message: 'Inaccessible / RLS filtered' } };
            }
            return { data: complaint, error: null };
          }
          return { data: null, error: { message: 'Not found' } };
        },
        order: () => {
          if (table === 'attachments') {
            // Simulate RLS: employee can only see attachments of complaints they own
            const complaint = mockComplaintsTable[val];
            if (!complaint || (currentMockProfile.role === 'employee' && complaint.created_by !== currentMockUser.id)) {
              return { data: [], error: null }; // RLS hides rows
            }
            const filtered = mockAttachmentsTable.filter((a) => a.complaint_id === val);
            return { data: filtered, error: null };
          }
          return { data: [], error: null };
        },
      }),
    }),
    insert: (payload: any) => {
      if (table === 'attachments') {
        const record = { id: `att-${Date.now()}`, ...payload };
        mockAttachmentsTable.push(record);
        return {
          select: () => ({
            single: () => ({ data: record, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          single: () => ({ data: payload, error: null }),
        }),
      };
    },
  }),
  storage: {
    from: () => ({
      createSignedUploadUrl: (storagePath: string) => ({
        data: { signedUrl: `https://storage.mock/${storagePath}?token=mock`, token: 'mock-token' },
        error: null,
      }),
      createSignedUrl: (storagePath: string) => ({
        data: { signedUrl: `https://storage.mock/download/${storagePath}?token=mock` },
        error: null,
      }),
    }),
  },
  rpc: (fn: string, args: any) => {
    mockRpcCalls.push({ fn, args });

    if (fn === 'transition_complaint') {
      const complaint = mockComplaintsTable[args.p_complaint_id];
      if (!complaint) {
        return { data: null, error: Object.assign(new Error('Complaint not found'), { code: 'P0002' }) };
      }

      // Check terminal states: closed and rejected have 0 transitions in allowed_transitions
      if (complaint.status === 'closed' || complaint.status === 'rejected') {
        return {
          data: null,
          error: Object.assign(
            new Error(`Invalid status transition: cannot change from ${complaint.status} to ${args.p_new_status}`),
            { code: 'P0001' },
          ),
        };
      }

      // Check allowed_transitions table
      const allowed = ALLOWED_TRANSITIONS[complaint.status] || [];
      if (!allowed.includes(args.p_new_status)) {
        return {
          data: null,
          error: Object.assign(
            new Error(`Invalid status transition: cannot change from ${complaint.status} to ${args.p_new_status}`),
            { code: 'P0001' },
          ),
        };
      }

      // Role check matching stored function transition_complaint:
      // IF v_caller_role = 'employee' THEN
      //   IF p_new_status != 'reopened' OR v_complaint.created_by != v_caller_id THEN
      //     RAISE EXCEPTION 'Employees may only reopen their own resolved complaints' USING ERRCODE = '42501';
      if (currentMockProfile.role === 'employee') {
        if (args.p_new_status !== 'reopened' || complaint.created_by !== currentMockUser.id) {
          return {
            data: null,
            error: Object.assign(
              new Error('Employees may only reopen their own resolved complaints'),
              { code: '42501' },
            ),
          };
        }
      }

      // Optimistic concurrency check
      if (args.p_expected_version !== complaint.version) {
        return {
          data: null,
          error: Object.assign(
            new Error(`Conflict: expected version ${args.p_expected_version}, but current version is ${complaint.version}`),
            { code: 'P0003' },
          ),
        };
      }

      complaint.status = args.p_new_status;
      complaint.version += 1;
      return {
        data: {
          success: true,
          complaint_id: args.p_complaint_id,
          to_status: args.p_new_status,
          new_version: complaint.version,
        },
        error: null,
      };
    }

    if (fn === 'assign_specialist') {
      if (currentMockProfile.role !== 'admin') {
        return {
          data: null,
          error: Object.assign(new Error('Only administrators can assign specialists'), { code: '42501' }),
        };
      }
      return {
        data: {
          success: true,
          assignment_id: 'assign-uuid-1',
          status: 'assigned',
        },
        error: null,
      };
    }

    return { data: null, error: null };
  },
};

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.id = 'req-challenger-2';
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

const { complaintsRouter } = await import('../routes/complaints.js');
const { attachmentsRouter } = await import('../routes/attachments.js');
const { errorHandler } = await import('../middleware/error-handler.js');

const app = express();
app.use(express.json());
app.use('/api/v1', complaintsRouter);
app.use('/api/v1', attachmentsRouter);
app.use(errorHandler);

describe('Challenger 2 — Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    mockRpcCalls = [];
    mockAttachmentsTable = [];
    currentMockUser = { id: 'emp-user-1', email: 'emp1@example.com' };
    currentMockProfile = { id: 'emp-user-1', full_name: 'Employee One', role: 'employee' };

    mockComplaintsTable = {
      'comp-emp-1': { id: 'comp-emp-1', created_by: 'emp-user-1', status: 'resolved', version: 3 },
      'comp-emp-2': { id: 'comp-emp-2', created_by: 'emp-user-2', status: 'resolved', version: 3 },
      'comp-closed': { id: 'comp-closed', created_by: 'emp-user-1', status: 'closed', version: 4 },
      'comp-rejected': { id: 'comp-rejected', created_by: 'emp-user-1', status: 'rejected', version: 2 },
      'comp-submitted': { id: 'comp-submitted', created_by: 'emp-user-1', status: 'submitted', version: 1 },
    };
  });

  // ===========================================================================
  // SECTION 1: Terminal State Invariants
  // ===========================================================================
  describe('1. Terminal State Invariants (closed & rejected)', () => {
    const allStatuses: ComplaintStatus[] = [
      'submitted',
      'under_review',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'rejected',
      'reopened',
    ];

    it('enforces that ALLOWED_TRANSITIONS has 0 outgoing transitions from closed', () => {
      expect(ALLOWED_TRANSITIONS['closed']).toEqual([]);
      expect(TRANSITION_PERMISSIONS['closed']).toEqual([]);
    });

    it('enforces that ALLOWED_TRANSITIONS has 0 outgoing transitions from rejected', () => {
      expect(ALLOWED_TRANSITIONS['rejected']).toEqual([]);
      expect(TRANSITION_PERMISSIONS['rejected']).toEqual([]);
    });

    it('systematically rejects EVERY possible outgoing transition originating from closed (even as admin)', async () => {
      currentMockProfile = { id: 'admin-1', full_name: 'Admin', role: 'admin' };

      for (const targetStatus of allStatuses) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-closed/transition')
          .send({
            new_status: targetStatus,
            expected_version: 4,
            note: `Attempting illegal transition from closed to ${targetStatus}`,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_TRANSITION');
        expect(res.body.error.message).toContain('Invalid status transition');
      }
    });

    it('systematically rejects EVERY possible outgoing transition originating from rejected (even as admin)', async () => {
      currentMockProfile = { id: 'admin-1', full_name: 'Admin', role: 'admin' };

      for (const targetStatus of allStatuses) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-rejected/transition')
          .send({
            new_status: targetStatus,
            expected_version: 2,
            note: `Attempting illegal transition from rejected to ${targetStatus}`,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_TRANSITION');
        expect(res.body.error.message).toContain('Invalid status transition');
      }
    });

    it('verifies UI button rendering logic evaluates to false for closed and rejected', () => {
      const terminalStatuses: ComplaintStatus[] = ['closed', 'rejected'];

      terminalStatuses.forEach((status) => {
        // Condition in ComplaintDetail.tsx and AdminPanel.tsx for Start Work / in_progress
        const showInProgress = ALLOWED_TRANSITIONS[status]?.includes('in_progress');
        expect(showInProgress).toBe(false);

        // Condition for Mark Resolved
        const showResolved = ALLOWED_TRANSITIONS[status]?.includes('resolved');
        expect(showResolved).toBe(false);

        // Condition for Close Ticket
        const showClose = ALLOWED_TRANSITIONS[status]?.includes('closed');
        expect(showClose).toBe(false);

        // Condition for Terminal State Banner
        const isTerminal = (ALLOWED_TRANSITIONS[status]?.length ?? 0) === 0;
        expect(isTerminal).toBe(true);

        // Condition for Employee Reopen
        const showEmployeeReopen = status === 'resolved';
        expect(showEmployeeReopen).toBe(false);
      });
    });
  });

  // ===========================================================================
  // SECTION 2: Employee Role Transition Restrictions
  // ===========================================================================
  describe('2. Employee Role Transition Restrictions', () => {
    it('blocks employee from advancing a submitted complaint to under_review', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-submitted/transition')
        .send({
          new_status: 'under_review',
          expected_version: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks employee from advancing a submitted complaint to in_progress or resolved', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-submitted/transition')
        .send({
          new_status: 'in_progress',
          expected_version: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks employee from closing a resolved complaint (only admin may close)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/transition')
        .send({
          new_status: 'closed',
          expected_version: 3,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks employee from reopening a complaint belonging to ANOTHER employee', async () => {
      // emp-user-1 tries to reopen comp-emp-2 (owned by emp-user-2)
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-2/transition')
        .send({
          new_status: 'reopened',
          expected_version: 3,
          note: 'Trying to reopen someone else complaint',
        });

      // Complaints lookup under RLS will fail or stored function check fails
      expect([403, 404]).toContain(res.status);
    });

    it('successfully permits employee to reopen their OWN resolved complaint', async () => {
      // emp-user-1 reopening comp-emp-1 (owned by emp-user-1)
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/transition')
        .send({
          new_status: 'reopened',
          expected_version: 3,
          note: 'Incident recurred, reopening ticket',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.result.to_status).toBe('reopened');
      expect(res.body.data.result.new_version).toBe(4);
    });

    it('blocks employee from assigning specialists to any complaint', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/assign')
        .send({
          assigned_to: '11111111-1111-1111-1111-111111111111',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  // SECTION 3: Storage MIME Whitelist Stress & Boundary Fuzzing
  // ===========================================================================
  describe('3. Storage MIME Whitelist Stress & Boundary Fuzzing', () => {
    const dangerousMimeTypes = [
      'application/x-sh',
      'application/javascript',
      'text/javascript',
      'application/x-msdownload',
      'application/x-dosexec',
      'text/html',
      'application/x-php',
      'text/x-php',
      'application/x-executable',
      'application/x-sharedlib',
      'image/svg+xml',
      'text/xml',
      'application/xml',
      'application/octet-stream',
      'application/zip',
      'application/x-tar',
      'application/x-7z-compressed',
      'application/x-python-code',
      'text/x-python',
      'application/x-bat',
      'application/vnd.microsoft.portable-executable',
      'multipart/form-data',
    ];

    dangerousMimeTypes.forEach((mime) => {
      it(`rejects upload-url generation for dangerous MIME type: ${mime}`, async () => {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments/upload-url')
          .send({
            file_name: 'test_file.dat',
            file_size: 1024,
            mime_type: mime,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });

      it(`rejects attachment confirmation for dangerous MIME type: ${mime}`, async () => {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments')
          .send({
            file_name: 'test_file.dat',
            file_size: 1024,
            mime_type: mime,
            storage_path: 'emp-user-1/comp-emp-1/test.pdf',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    it('rejects malformed and injected MIME types', async () => {
      const malformedMimes = [
        '',
        '   ',
        'image/jpeg; boundary=something',
        'IMAGE/PNG',
        'Image/Jpeg',
        'image/png\0.exe',
        'image/png\r\nSet-Cookie: evil=1',
        '../image/png',
        'image/*',
        '*/*',
      ];

      for (const mime of malformedMimes) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments/upload-url')
          .send({
            file_name: 'test.png',
            file_size: 1024,
            mime_type: mime,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('accepts all legitimate whitelisted MIME types', async () => {
      for (const validMime of ALLOWED_MIME_TYPES) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments/upload-url')
          .send({
            file_name: 'legit_evidence.file',
            file_size: 4096,
            mime_type: validMime,
          });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('upload_url');
        expect(res.body.data).toHaveProperty('storage_path');
      }
    });

    it('enforces maximum file size limit of 10MB (10485760 bytes)', async () => {
      // 10MB + 1 byte
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/attachments/upload-url')
        .send({
          file_name: 'large_photo.jpg',
          file_size: 10485761,
          mime_type: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('enforces minimum file size limit of 1 byte', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/attachments/upload-url')
        .send({
          file_name: 'empty.jpg',
          file_size: 0,
          mime_type: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // SECTION 4: Storage Path Traversal Prevention
  // ===========================================================================
  describe('4. Storage Path Traversal Prevention', () => {
    it('disarms path traversal sequences in file_name during upload-url generation', async () => {
      const traversalFilenames = [
        '../../../../etc/passwd.pdf',
        '..\\..\\..\\windows\\system32\\cmd.exe.png',
        '....//....//etc/shadow.jpg',
        '..%2f..%2fsecret.pdf',
        '/root/secret.pdf',
        'C:\\Windows\\system.ini.png',
      ];

      for (const fileName of traversalFilenames) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments/upload-url')
          .send({
            file_name: fileName,
            file_size: 2048,
            mime_type: 'application/pdf',
          });

        expect(res.status).toBe(200);
        const generatedPath: string = res.body.data.storage_path;

        // Verify storage_path is strictly strictly prefixed with user and complaint
        expect(generatedPath.startsWith('emp-user-1/comp-emp-1/')).toBe(true);

        // Verify no directory traversal tokens exist anywhere in the generated storage path
        expect(generatedPath).not.toContain('..');
        expect(generatedPath).not.toContain('\\');
        expect(generatedPath).not.toContain('/etc');
        expect(generatedPath).not.toContain('passwd');
        expect(generatedPath).not.toContain('Windows');
      }
    });

    it('rejects confirmation with adversarial path traversal payloads in storage_path', async () => {
      const traversalPayloads = [
        'emp-user-1/comp-emp-1/../../etc/passwd.pdf',
        'emp-user-1/comp-emp-1/..\\..\\win.ini.pdf',
        'emp-user-1/comp-emp-1/../../../../var/log.pdf',
        'emp-user-1/comp-emp-1/subfolder/file.pdf',
        'emp-user-1/comp-emp-1/sub/dir/nested.pdf',
        'emp-user-1/comp-emp-1/.',
        'emp-user-1/comp-emp-1/..',
        'emp-user-1/comp-emp-1/',
        'emp-user-1/comp-emp-1/file.pdf/',
        'emp-user-1/comp-emp-1/file.pdf\\',
        'emp-user-1/comp-emp-1//file.pdf',
        'emp-user-1/comp-emp-1/file with spaces.pdf',
        'emp-user-1/comp-emp-1/file;rm.pdf',
        'emp-user-1/comp-emp-1/file\0.pdf',
        'emp-user-1/comp-emp-1/noextension',
      ];

      for (const payload of traversalPayloads) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments')
          .send({
            file_name: 'test.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            storage_path: payload,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_STORAGE_PATH');
      }
    });

    it('rejects absolute paths and non-prefixed paths in confirmation', async () => {
      const absolutePayloads = [
        '/etc/passwd',
        '/var/storage/file.pdf',
        'C:\\Windows\\system32\\cmd.exe',
        'attachments/emp-user-1/comp-emp-1/file.pdf',
      ];

      for (const payload of absolutePayloads) {
        const res = await request(app)
          .post('/api/v1/complaints/comp-emp-1/attachments')
          .send({
            file_name: 'test.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            storage_path: payload,
          });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  // ===========================================================================
  // SECTION 5: Cross-User Storage Access (IDOR / BOLA Prevention)
  // ===========================================================================
  describe('5. Cross-User Storage Access (IDOR / BOLA Prevention)', () => {
    it('prevents non-owner from requesting upload-url for another user complaint', async () => {
      // emp-user-1 requests upload-url for comp-emp-2 (owned by emp-user-2)
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-2/attachments/upload-url')
        .send({
          file_name: 'malicious_upload.png',
          file_size: 2048,
          mime_type: 'image/png',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('prevents non-owner from registering attachment confirmation for another user complaint', async () => {
      // emp-user-1 tries to confirm attachment on comp-emp-2
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-2/attachments')
        .send({
          file_name: 'injected.png',
          file_size: 2048,
          mime_type: 'image/png',
          storage_path: 'emp-user-1/comp-emp-2/valid-uuid.png',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects storage_path spoofing where caller impersonates another user ID (BOLA)', async () => {
      // emp-user-1 tries to confirm attachment using emp-user-2's folder prefix
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/attachments')
        .send({
          file_name: 'stolen_access.png',
          file_size: 1024,
          mime_type: 'image/png',
          storage_path: 'emp-user-2/comp-emp-1/some-uuid.png',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Storage path does not belong to the authenticated user');
    });

    it('rejects storage_path spoofing where storage_path complaint ID mismatches route ID', async () => {
      // emp-user-1 tries to link attachment from comp-submitted into comp-emp-1
      const res = await request(app)
        .post('/api/v1/complaints/comp-emp-1/attachments')
        .send({
          file_name: 'mismatched_complaint.png',
          file_size: 1024,
          mime_type: 'image/png',
          storage_path: 'emp-user-1/comp-submitted/some-uuid.png',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents non-owner from reading private attachments or obtaining signed download URLs', async () => {
      // Seed an attachment on comp-emp-2
      mockAttachmentsTable.push({
        id: 'att-secret-99',
        complaint_id: 'comp-emp-2',
        uploaded_by: 'emp-user-2',
        file_name: 'private_salary_evidence.pdf',
        file_size: 50000,
        mime_type: 'application/pdf',
        storage_path: 'emp-user-2/comp-emp-2/secret.pdf',
      });

      // emp-user-1 requests GET attachments for comp-emp-2
      const res = await request(app).get('/api/v1/complaints/comp-emp-2/attachments');

      expect(res.status).toBe(200);
      // RLS filters the attachments to empty array; zero signed URLs leaked!
      expect(res.body.data).toEqual([]);
    });

    it('permits complaint owner to list their own attachments with signed download URLs', async () => {
      // Seed an attachment on comp-emp-1
      mockAttachmentsTable.push({
        id: 'att-emp1-01',
        complaint_id: 'comp-emp-1',
        uploaded_by: 'emp-user-1',
        file_name: 'network_photo.jpg',
        file_size: 12000,
        mime_type: 'image/jpeg',
        storage_path: 'emp-user-1/comp-emp-1/photo.jpg',
      });

      // emp-user-1 requests GET attachments for their own complaint
      const res = await request(app).get('/api/v1/complaints/comp-emp-1/attachments');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('att-emp1-01');
      expect(res.body.data[0].download_url).toContain('https://storage.mock/download/');
    });
  });
});
