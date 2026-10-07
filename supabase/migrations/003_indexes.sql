-- ============================================================
-- Migration 003: Performance-Driven Composite Indexes
-- Purpose: Accelerate the specific query patterns executed by
-- the web app and API. Every index below documents its exact query.
-- ============================================================

-- Query: Dept head listing department complaints filtered by status, ordered by newest first.
-- Index justification: department_id (equality) -> status (equality/in) -> created_at DESC (range/sort).
-- Postgres can satisfy filter and sort in a single B-tree index scan without an explicit Sort node.
CREATE INDEX IF NOT EXISTS idx_complaints_dept_status_created
  ON complaints (department_id, status, created_at DESC);

-- Query: Employee dashboard viewing own complaints ordered by newest first.
-- Index justification: created_by (equality) -> created_at DESC (sort).
-- Directly eliminates in-memory quicksort for high-volume employees.
CREATE INDEX IF NOT EXISTS idx_complaints_created_by_created
  ON complaints (created_by, created_at DESC);

-- Query: Global filter by status and priority (Admin oversight & triage dashboard).
-- Index justification: status (equality) -> priority (equality).
CREATE INDEX IF NOT EXISTS idx_complaints_status_priority
  ON complaints (status, priority);

-- Query: Full-text substring and typo-tolerant search across title & description.
-- Index justification: GIN trigram index enables fast ILIKE and %keyword% matching
-- without sequential scanning across 10,000+ complaints.
CREATE INDEX IF NOT EXISTS idx_complaints_trgm_search
  ON complaints USING gin (
    (title || ' ' || description) gin_trgm_ops
  );

-- Query: Find active assignments for a user or look up active worker.
-- Index justification: Partial index keeps index size tiny (only active assignments are indexed).
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_active
  ON assignments (assigned_to, is_active)
  WHERE is_active = true;

-- Query: Fetch chronologically ordered comments for complaint detail page.
-- Index justification: complaint_id (equality) -> created_at ASC (ordering).
CREATE INDEX IF NOT EXISTS idx_comments_complaint_created
  ON comments (complaint_id, created_at ASC);

-- Query: Fetch chronological status timeline for complaint detail view.
-- Index justification: complaint_id (equality) -> created_at ASC.
CREATE INDEX IF NOT EXISTS idx_status_history_complaint_created
  ON status_history (complaint_id, created_at ASC);

-- Query: Fetch unread notifications for a user, ordered by newest first.
-- Index justification: Partial index on is_read = false keeps the index footprint minimal
-- and speeds up navbar notification badge and popover queries.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- Query: Admin reviewing audit trail for a specific entity/row.
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_row
  ON audit_logs (table_name, row_id, created_at DESC);

-- Query: Admin tracking recent actions performed by a specific user.
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON audit_logs (actor, created_at DESC);
