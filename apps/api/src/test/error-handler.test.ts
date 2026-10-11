import { describe, it, expect, vi } from 'vitest';
import { errorHandler, AppError } from '../middleware/error-handler.js';
import type { Request, Response } from 'express';

function createMockReqRes() {
  const req = {
    id: 'req-err-123',
    method: 'POST',
    originalUrl: '/api/v1/complaints/123/transition',
  } as Request;

  let statusCode = 200;
  let jsonBody: any = null;

  const res = {
    status: vi.fn((code: number) => {
      statusCode = code;
      (res as any).statusCode = code;
      return res;
    }),
    json: vi.fn((body: any) => {
      jsonBody = body;
      return res;
    }),
    statusCode: 200,
  } as unknown as Response;

  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
}

describe('Structured Error Handler Mapping Tests (R4.2)', () => {
  it('maps P0001 (Invalid status transition) to HTTP 400 INVALID_TRANSITION', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('Invalid status transition: cannot change from submitted to resolved'), {
      code: 'P0001',
    });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(400);
    expect(getBody().error.code).toBe('INVALID_TRANSITION');
  });

  it('maps P0002 (Not found) to HTTP 404 NOT_FOUND', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('Complaint not found'), { code: 'P0002' });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(404);
    expect(getBody().error.code).toBe('NOT_FOUND');
    expect(getBody().error.message).toContain('Resource not found or inaccessible');
  });

  it('maps PGRST116 (PostgREST single row not found) to HTTP 404 NOT_FOUND', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('JSON object requested, multiple (or no) rows returned'), {
      code: 'PGRST116',
    });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(404);
    expect(getBody().error.code).toBe('NOT_FOUND');
  });

  it('maps P0003 (Stale version conflict) to HTTP 409 VERSION_CONFLICT', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('Conflict: expected version 5, but current version is 6'), {
      code: 'P0003',
    });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(409);
    expect(getBody().error.code).toBe('VERSION_CONFLICT');
    expect(getBody().error.message).toContain('updated by another user');
  });

  it('maps P0004 (Transition forbidden) to HTTP 403 TRANSITION_FORBIDDEN', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('Employees may only reopen their own resolved complaints'), {
      code: 'P0004',
    });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(403);
    expect(getBody().error.code).toBe('TRANSITION_FORBIDDEN');
  });

  it('maps 42501 (PostgreSQL permission denied / RLS violation) to HTTP 403 FORBIDDEN', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('Non-admin users are strictly forbidden from modifying user roles'), {
      code: '42501',
    });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(403);
    expect(getBody().error.code).toBe('FORBIDDEN');
  });

  it('maps P0005 (Direct complaint status update forbidden) to HTTP 403 DIRECT_STATUS_UPDATE_FORBIDDEN', () => {
    const { req, res, getStatus, getBody } = createMockReqRes();
    const err = Object.assign(new Error('Direct UPDATE of complaint status is forbidden'), {
      code: 'P0005',
    });

    errorHandler(err, req, res, () => {});

    expect(getStatus()).toBe(403);
    expect(getBody().error.code).toBe('DIRECT_STATUS_UPDATE_FORBIDDEN');
  });

  it('maps P0006 and 55000 (Immutable audit log) to HTTP 403 AUDIT_LOG_IMMUTABLE', () => {
    const { req: req1, res: res1, getStatus: getStatus1, getBody: getBody1 } = createMockReqRes();
    const err1 = Object.assign(new Error('Audit log table is append-only'), { code: 'P0006' });
    errorHandler(err1, req1, res1, () => {});
    expect(getStatus1()).toBe(403);
    expect(getBody1().error.code).toBe('AUDIT_LOG_IMMUTABLE');

    const { req: req2, res: res2, getStatus: getStatus2, getBody: getBody2 } = createMockReqRes();
    const err2 = Object.assign(new Error('Audit log table is append-only'), { code: '55000' });
    errorHandler(err2, req2, res2, () => {});
    expect(getStatus2()).toBe(403);
    expect(getBody2().error.code).toBe('AUDIT_LOG_IMMUTABLE');
  });

  it('sanitizes internal errors in production environment', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const { req, res, getStatus, getBody } = createMockReqRes();
      const err = new Error('FATAL: connection to database credentials leak test');
      errorHandler(err, req, res, () => {});

      expect(getStatus()).toBe(500);
      expect(getBody().error.message).toBe('An unexpected internal error occurred');
      expect(getBody().error.message).not.toContain('credentials leak');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
