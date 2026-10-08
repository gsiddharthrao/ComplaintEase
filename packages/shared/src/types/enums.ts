/**
 * Enums mirror the Postgres enum types defined in migrations.
 * Keeping them in sync here gives us TypeScript type safety across the whole stack.
 * If you change the DB enum, update this file too.
 */

/** User roles — maps to user_role Postgres enum */
export type UserRole = 'employee' | 'admin';

/** Complaint lifecycle status — maps to complaint_status Postgres enum */
export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'rejected'
  | 'reopened';

/** Priority tiers — maps to complaint_priority Postgres enum */
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['under_review', 'assigned', 'in_progress', 'rejected'],
  under_review: ['assigned', 'in_progress', 'resolved', 'rejected'],
  assigned: ['in_progress', 'resolved', 'closed', 'rejected'],
  in_progress: ['resolved', 'assigned', 'closed', 'rejected'],
  resolved: ['closed', 'reopened', 'in_progress'],
  closed: [],           // terminal state
  rejected: [],         // terminal state
  reopened: ['in_progress', 'assigned', 'resolved', 'rejected'],
};

/** Which roles may trigger each transition */
export const TRANSITION_PERMISSIONS: Record<ComplaintStatus, UserRole[]> = {
  submitted: ['admin'],
  under_review: ['admin'],
  assigned: ['admin'],
  in_progress: ['admin'],
  resolved: ['admin', 'employee'], // employee can reopen or admin can close
  closed: [],
  rejected: [],
  reopened: ['admin'],
};
