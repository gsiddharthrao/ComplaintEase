-- ============================================================
-- Migration 001: Extensions and Enum Types
-- Purpose: Set up required Postgres extensions and define
-- all enum types used throughout the schema.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- User role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'dept_head', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Complaint status enum
DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM (
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'resolved',
    'closed',
    'rejected',
    'reopened'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Complaint priority enum
DO $$ BEGIN
  CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

