import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  SPECIALIST_PERMITTED_TRANSITIONS,
  CREATOR_PERMITTED_TRANSITIONS,
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
    expect(CREATOR_PERMITTED_TRANSITIONS['resolved']).toContain('reopened');
  });

  it('allows reopened complaint to move back to in_progress', () => {
    expect(ALLOWED_TRANSITIONS['reopened']).toContain('in_progress');
  });

  it('treats closed and rejected as terminal states', () => {
    expect(ALLOWED_TRANSITIONS['closed']).toEqual([]);
    expect(ALLOWED_TRANSITIONS['rejected']).toEqual([]);
  });

  it('defines specialist employee transition matrix for assigned and in_progress', () => {
    // Assigned specialists (employees) can transition assigned -> in_progress and in_progress -> resolved
    expect(TRANSITION_PERMISSIONS['assigned']).toContain('employee');
    expect(TRANSITION_PERMISSIONS['in_progress']).toContain('employee');
    expect(SPECIALIST_PERMITTED_TRANSITIONS['assigned']).toEqual(['in_progress']);
    expect(SPECIALIST_PERMITTED_TRANSITIONS['in_progress']).toEqual(['resolved']);

    // Non-specialist states strictly disallow employee transitions
    expect(TRANSITION_PERMISSIONS['under_review']).not.toContain('employee');
    expect(TRANSITION_PERMISSIONS['submitted']).not.toContain('employee');
    expect(TRANSITION_PERMISSIONS['reopened']).not.toContain('employee');
  });

  it('verifies admin permissions across lifecycle', () => {
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
    });
  });

  it('validates specialist transition map isolation', () => {
    expect(SPECIALIST_PERMITTED_TRANSITIONS['assigned']).toEqual(['in_progress']);
    expect(SPECIALIST_PERMITTED_TRANSITIONS['in_progress']).toEqual(['resolved']);
    const nonSpecialistStatuses: ComplaintStatus[] = [
      'submitted',
      'under_review',
      'resolved',
      'closed',
      'rejected',
      'reopened',
    ];
    nonSpecialistStatuses.forEach((st) => {
      expect(SPECIALIST_PERMITTED_TRANSITIONS[st]).toEqual([]);
    });
  });

  it('validates creator transition map isolation', () => {
    expect(CREATOR_PERMITTED_TRANSITIONS['resolved']).toEqual(['reopened']);
    const nonCreatorStatuses: ComplaintStatus[] = [
      'submitted',
      'under_review',
      'assigned',
      'in_progress',
      'closed',
      'rejected',
      'reopened',
    ];
    nonCreatorStatuses.forEach((st) => {
      expect(CREATOR_PERMITTED_TRANSITIONS[st]).toEqual([]);
    });
  });
});

