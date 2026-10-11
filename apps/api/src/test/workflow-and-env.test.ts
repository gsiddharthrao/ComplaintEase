import { describe, it, expect } from 'vitest';
import { validateEnv } from '../config/env.js';
import { app } from '../app.js';
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  ComplaintStatus,
} from '@complaintease/shared';
import { ALLOWED_MIME_TYPES } from '../routes/attachments.js';

describe('Workflow, Security Invariants & Environment Hardening (R1-R7)', () => {
  describe('Environment Validation Fail-Fast (Scenario 13)', () => {
    it('throws on startup in production when Supabase URL is placeholder', () => {
      const prodWithPlaceholder = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://placeholder.supabase.co',
        SUPABASE_ANON_KEY: 'ey-real-key',
        SUPABASE_SERVICE_ROLE_KEY: 'ey-real-service-key',
      };

      expect(() => validateEnv(prodWithPlaceholder)).toThrow(
        /Production environment cannot start with placeholder Supabase credentials/,
      );
    });

    it('throws on startup in production when Supabase keys are missing or defaulted to placeholders', () => {
      const prodMissingKeys = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
      };

      expect(() => validateEnv(prodMissingKeys)).toThrow(
        /Production environment cannot start with placeholder Supabase credentials/,
      );
    });

    it('throws on startup in production when URL format is invalid', () => {
      const prodInvalid = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'not-a-valid-url',
        SUPABASE_ANON_KEY: 'ey-key',
        SUPABASE_SERVICE_ROLE_KEY: 'ey-role',
      };

      expect(() => validateEnv(prodInvalid)).toThrow(
        /Production environment validation failed/,
      );
    });

    it('succeeds in production when valid non-placeholder credentials are provided', () => {
      const validProd = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://project-prod.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_anon',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_service',
      };

      const result = validateEnv(validProd);
      expect(result.success).toBe(true);
    });

    it('allows fallback in development / test environments', () => {
      const testEnv = {
        NODE_ENV: 'test',
      };

      const result = validateEnv(testEnv);
      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limiter & Reverse Proxy Trust (Scenario 12)', () => {
    it('has trust proxy enabled to correctly resolve client IP behind reverse proxies', () => {
      expect(app.get('trust proxy')).toBe(1);
    });
  });

  describe('Canonical State Machine Matrix Integrity (Scenarios 5, 14, 15)', () => {
    it('contains exactly 23 transitions across all complaint lifecycle states (Scenario 5)', () => {
      const transitionsCount = Object.values(ALLOWED_TRANSITIONS).reduce(
        (sum, targets) => sum + targets.length,
        0,
      );
      expect(transitionsCount).toBe(23);
    });

    it('enforces terminal states closed and rejected have 0 outgoing transitions (Scenario 14)', () => {
      expect(ALLOWED_TRANSITIONS['closed']).toEqual([]);
      expect(ALLOWED_TRANSITIONS['rejected']).toEqual([]);
      expect(TRANSITION_PERMISSIONS['closed']).toEqual([]);
      expect(TRANSITION_PERMISSIONS['rejected']).toEqual([]);
    });

    it('restricts employee transitions strictly to resolved -> reopened (Scenario 15)', () => {
      const statuses: ComplaintStatus[] = [
        'submitted',
        'under_review',
        'assigned',
        'in_progress',
        'closed',
        'rejected',
        'reopened',
      ];

      // Non-resolved states do NOT include employee
      statuses.forEach((status) => {
        expect(TRANSITION_PERMISSIONS[status]).not.toContain('employee');
      });

      // Resolved state permits employee (for reopening) and admin
      expect(TRANSITION_PERMISSIONS['resolved']).toContain('employee');
      expect(TRANSITION_PERMISSIONS['resolved']).toContain('admin');
      expect(ALLOWED_TRANSITIONS['resolved']).toContain('reopened');
    });
  });

  describe('Attachment MIME Whitelist Integrity (Scenario 3)', () => {
    it('contains all permitted document and image MIME types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/webp');
      expect(ALLOWED_MIME_TYPES).toContain('image/gif');
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('text/plain');
      expect(ALLOWED_MIME_TYPES).toContain('application/msword');
      expect(ALLOWED_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('disallows dangerous executable, script, or web MIME types', () => {
      const dangerousMimes = [
        'application/x-sh',
        'application/javascript',
        'text/html',
        'application/x-msdownload',
        'application/x-php',
      ];

      dangerousMimes.forEach((mime) => {
        expect(ALLOWED_MIME_TYPES).not.toContain(mime);
      });
    });
  });
});
