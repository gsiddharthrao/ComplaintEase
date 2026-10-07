import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  ComplaintStatus,
} from '@complaintease/shared';

describe('State Machine & Transition Rules', () => {
  it('defines valid initial transitions from submitted', () => {
    expect(ALLOWED_TRANSITIONS['submitted']).toContain('under_review');
    expect(ALLOWED_TRANSITIONS['submitted']).toContain('rejected');
    expect(ALLOWED_TRANSITIONS['submitted']).not.toContain('resolved');
  });

  it('allows employee to reopen resolved complaint', () => {
    expect(ALLOWED_TRANSITIONS['resolved']).toContain('reopened');
    expect(TRANSITION_PERMISSIONS['resolved']).toContain('employee');
  });

  it('allows reopened complaint to move back to in_progress', () => {
    expect(ALLOWED_TRANSITIONS['reopened']).toContain('in_progress');
  });

  it('treats closed and rejected as terminal states', () => {
    expect(ALLOWED_TRANSITIONS['closed']).toEqual([]);
    expect(ALLOWED_TRANSITIONS['rejected']).toEqual([]);
  });

  it('prohibits employee from directly resolving or closing complaints', () => {
    expect(TRANSITION_PERMISSIONS['in_progress']).not.toContain('employee');
    expect(TRANSITION_PERMISSIONS['under_review']).not.toContain('employee');
    expect(TRANSITION_PERMISSIONS['submitted']).not.toContain('employee');
  });

  it('verifies dept_head and admin permissions across lifecycle', () => {
    const statuses: ComplaintStatus[] = [
      'submitted',
      'under_review',
      'assigned',
      'in_progress',
      'resolved',
      'reopened',
    ];

    statuses.forEach((status) => {
      expect(TRANSITION_PERMISSIONS[status]).toContain('admin');
      expect(TRANSITION_PERMISSIONS[status]).toContain('dept_head');
    });
  });
});

