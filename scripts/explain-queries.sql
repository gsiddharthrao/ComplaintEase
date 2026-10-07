-- ============================================================
-- EXPLAIN ANALYZE Benchmarking Script for the 3 Core Queries
-- Run this in psql or Supabase SQL Editor against 10,000+ seeded rows
-- ============================================================

-- QUERY 1: Department Head triage filtering
-- Query Pattern: filter by department_id and status, ordered by created_at DESC
-- Index targeted: idx_complaints_dept_status_created (department_id, status, created_at DESC)
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT
  c.id, c.title, c.status, c.priority, c.created_at,
  d.name AS dept_name,
  p.full_name AS creator_name
FROM complaints c
JOIN departments d ON d.id = c.department_id
JOIN profiles p ON p.id = c.created_by
WHERE c.department_id = '11111111-1111-1111-1111-111111111111'
  AND c.status = 'submitted'
ORDER BY c.created_at DESC
LIMIT 20;

-- QUERY 2: Employee Dashboard listing own complaints
-- Query Pattern: filter by created_by, ordered by created_at DESC
-- Index targeted: idx_complaints_created_by_created (created_by, created_at DESC)
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT
  c.id, c.title, c.status, c.priority, c.created_at,
  d.name AS dept_name
FROM complaints c
JOIN departments d ON d.id = c.department_id
WHERE c.created_by = (SELECT id FROM profiles WHERE role = 'employee' LIMIT 1)
ORDER BY c.created_at DESC
LIMIT 20;

-- QUERY 3: Full-text & substring search across title and description
-- Query Pattern: keyword search using pg_trgm ILIKE
-- Index targeted: idx_complaints_trgm_search (GIN trgm on title || ' ' || description)
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT
  c.id, c.title, c.description, c.status, c.created_at
FROM complaints c
WHERE (c.title || ' ' || c.description) ILIKE '%outage%'
ORDER BY c.created_at DESC
LIMIT 20;
