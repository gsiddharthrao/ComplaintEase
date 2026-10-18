import { describe, it, expect } from 'vitest';
import { validateEnv } from '../config/env.js';
import { app } from '../app.js';
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  SPECIALIST_PERMITTED_TRANSITIONS,
  CREATOR_PERMITTED_TRANSITIONS,
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

  describe('Production Database Safeguard (Non-Production Protection)', () => {
    it('rejects development connecting to production Supabase without explicit opt-in', () => {
      const devPointingToProd = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://kdsjbdxtakgslextabpi.supabase.co',
        SUPABASE_ANON_KEY: 'ey-dev-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'ey-dev-service-role-key',
      };

      expect(() => validateEnv(devPointingToProd)).toThrow(
        /Refusing to connect non-production environment \(development\) to production Supabase project \(kdsjbdxtakgslextabpi\)/,
      );
    });

    it('rejects test environment connecting to production Supabase without explicit opt-in', () => {
      const testPointingToProd = {
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://kdsjbdxtakgslextabpi.supabase.co',
        SUPABASE_ANON_KEY: 'ey-test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'ey-test-service-role-key',
      };

      expect(() => validateEnv(testPointingToProd)).toThrow(
        /Refusing to connect non-production environment \(test\) to production Supabase project \(kdsjbdxtakgslextabpi\)/,
      );
    });

    it('permits development connecting to production with explicit documented opt-in (ALLOW_PROD_DB_IN_DEV=true)', () => {
      const devWithOptIn = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://kdsjbdxtakgslextabpi.supabase.co',
        SUPABASE_ANON_KEY: 'ey-dev-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'ey-dev-service-role-key',
        ALLOW_PROD_DB_IN_DEV: 'true',
      };

      const result = validateEnv(devWithOptIn);
      expect(result.success).toBe(true);
      expect(result.data?.SUPABASE_URL).toContain('kdsjbdxtakgslextabpi');
    });

    it('permits normal development and mocked test configuration', () => {
      const normalDev = {
        NODE_ENV: 'development',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_ANON_KEY: 'local-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
      };
      const devResult = validateEnv(normalDev);
      expect(devResult.success).toBe(true);

      const mockedConfig = {
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://placeholder.supabase.co',
        SUPABASE_ANON_KEY: 'mock-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      };
      const mockResult = validateEnv(mockedConfig);
      expect(mockResult.success).toBe(true);
    });

    it('rejects production configuration with missing or placeholder credentials', () => {
      const prodMissing = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
      };
      expect(() => validateEnv(prodMissing)).toThrow(
        /Production environment cannot start with placeholder Supabase credentials/,
      );

      const prodPlaceholderKey = {
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://real-prod-ref.supabase.co',
        SUPABASE_ANON_KEY: 'placeholder-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'real-service-key',
      };
      expect(() => validateEnv(prodPlaceholderKey)).toThrow(
        /Production environment cannot start with placeholder Supabase credentials/,
      );
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

    it('restricts employee transitions strictly to specialist work and creator reopening (Scenario 15)', () => {
      const nonEmployeeStatuses: ComplaintStatus[] = [
        'submitted',
        'under_review',
        'closed',
        'rejected',
        'reopened',
      ];

      // Non-employee states do NOT include employee
      nonEmployeeStatuses.forEach((status) => {
        expect(TRANSITION_PERMISSIONS[status]).not.toContain('employee');
      });

      // Resolved state permits employee (for creator reopening) and admin
      expect(TRANSITION_PERMISSIONS['resolved']).toContain('employee');
      expect(TRANSITION_PERMISSIONS['resolved']).toContain('admin');
      expect(ALLOWED_TRANSITIONS['resolved']).toContain('reopened');
      expect(CREATOR_PERMITTED_TRANSITIONS['resolved']).toContain('reopened');

      // Assigned & in_progress permit employee (for active specialist work)
      expect(TRANSITION_PERMISSIONS['assigned']).toContain('employee');
      expect(TRANSITION_PERMISSIONS['in_progress']).toContain('employee');
      expect(SPECIALIST_PERMITTED_TRANSITIONS['assigned']).toContain('in_progress');
      expect(SPECIALIST_PERMITTED_TRANSITIONS['in_progress']).toContain('resolved');
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
