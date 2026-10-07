/**
 * Enums mirror the Postgres enum types defined in migrations.
 * Keeping them in sync here gives us TypeScript type safety across the whole stack.
 * If you change the DB enum, update this file too.
 */

/** User roles — maps to user_role Postgres enum */
export type UserRole = 'employee' | 'dept_head' | 'admin';

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

/** Allowed status transitions — enforced in DB function AND API */
export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: ['closed', 'reopened'],
  closed: [],           // terminal state
  rejected: [],         // terminal state
  reopened: ['in_progress'],
};

/** Which roles may trigger each transition */
export const TRANSITION_PERMISSIONS: Record<ComplaintStatus, UserRole[]> = {
  submitted: ['dept_head', 'admin'],
  under_review: ['dept_head', 'admin'],
  assigned: ['dept_head', 'admin'],
  in_progress: ['dept_head', 'admin'],
  resolved: ['dept_head', 'admin', 'employee'], // employee can reopen or admin/dept_head can close
  closed: [],
  rejected: [],
  reopened: ['dept_head', 'admin'],
};
