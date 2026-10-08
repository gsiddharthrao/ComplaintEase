import { describe, it, expect } from 'vitest';
import {
  createComplaintSchema,
  listComplaintsSchema,
  transitionSchema,
  assignSchema,
  registerSchema,
} from '@complaintease/shared';

describe('Validator Unit Tests', () => {
  describe('createComplaintSchema', () => {
    it('accepts valid complaint input', () => {
      const valid = {
        title: 'Network Outage in Lab 2',
        description: 'The primary switch is completely unresponsive and failing to route packets to the core gateway.',
        category_id: '11111111-1111-1111-1111-111111111111',
        department_id: '22222222-2222-2222-2222-222222222222',
        priority: 'high',
      };
      const result = createComplaintSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects too short title', () => {
      const invalid = {
        title: 'Fix',
        description: 'Detailed description that exceeds minimum length requirements.',
        category_id: '11111111-1111-1111-1111-111111111111',
        department_id: '22222222-2222-2222-2222-222222222222',
      };
      const result = createComplaintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('title');
      }
    });

    it('rejects too short description', () => {
      const invalid = {
        title: 'Valid Title Here',
        description: 'Too short',
        category_id: '11111111-1111-1111-1111-111111111111',
        department_id: '22222222-2222-2222-2222-222222222222',
      };
      const result = createComplaintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('description');
      }
    });

    it('rejects invalid uuid for category_id', () => {
      const invalid = {
        title: 'Valid Title Here',
        description: 'This is a sufficiently long description that satisfies the schema constraint.',
        category_id: 'not-a-uuid',
        department_id: '22222222-2222-2222-2222-222222222222',
      };
      const result = createComplaintSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('transitionSchema', () => {
    it('accepts valid transition payload with expected_version', () => {
      const valid = {
        new_status: 'in_progress',
        note: 'Engineer has begun investigation',
        expected_version: 3,
      };
      const result = transitionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing or zero expected_version', () => {
      const invalid = {
        new_status: 'resolved',
        expected_version: 0,
      };
      const result = transitionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid status enum value', () => {
      const invalid = {
        new_status: 'flying',
        expected_version: 1,
      };
      const result = transitionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('assignSchema', () => {
    it('accepts valid assignment', () => {
      const valid = {
        assigned_to: '33333333-3333-3333-3333-333333333333',
        note: 'High priority hardware ticket',
      };
      const result = assignSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects non-uuid assigned_to', () => {
      const invalid = {
        assigned_to: 'invalid-id',
      };
      const result = assignSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('validates password complexity (uppercase + number + min 8)', () => {
      const weak = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test User',
      };
      const result = registerSchema.safeParse(weak);
      expect(result.success).toBe(false);

      const strong = {
        email: 'test@example.com',
        password: 'Password123!',
        full_name: 'Test User',
      };
      expect(registerSchema.safeParse(strong).success).toBe(true);
    });
  });

  describe('listComplaintsSchema', () => {
    it('coerces and defaults limit', () => {
      const result = listComplaintsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('accepts keyset cursor format', () => {
      const result = listComplaintsSchema.safeParse({
        cursor: '2026-10-07T12:00:00.000Z__11111111-1111-1111-1111-111111111111',
      });
      expect(result.success).toBe(true);
    });

    it('accepts search strings with special characters', () => {
      const result = listComplaintsSchema.safeParse({
        search: 'machinery, motor (pump)',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('machinery, motor (pump)');
      }
    });
  });
});

