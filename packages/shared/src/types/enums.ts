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

/** Which roles may trigger transitions from a given status */
export const TRANSITION_PERMISSIONS: Record<ComplaintStatus, UserRole[]> = {
  submitted: ['admin'],
  under_review: ['admin'],
  assigned: ['admin', 'employee'], // admin, or actively assigned employee
  in_progress: ['admin', 'employee'], // admin, or actively assigned employee
  resolved: ['admin', 'employee'], // admin can close/progress, employee can reopen own complaint
  closed: [],
  rejected: [],
  reopened: ['admin'],
};

/**
 * Fine-grained transition permissions for employee specialists:
 * Actively assigned employees may only advance assigned -> in_progress, and in_progress -> resolved.
 */
export const SPECIALIST_PERMITTED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  submitted: [],
  under_review: [],
  resolved: [],
  closed: [],
  rejected: [],
  reopened: [],
};

/**
 * Fine-grained transition permissions for complaint creators:
 * Employees may only reopen their own resolved complaints.
 */
export const CREATOR_PERMITTED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  resolved: ['reopened'],
  submitted: [],
  under_review: [],
  assigned: [],
  in_progress: [],
  closed: [],
  rejected: [],
  reopened: [],
};
