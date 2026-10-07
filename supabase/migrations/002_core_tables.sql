-- ============================================================
-- Migration 002: Core Tables (3NF Schema)
-- ============================================================

-- 1. departments
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE CHECK (length(trim(name)) >= 2),
  description TEXT,
  head_id     UUID, -- FK added after profiles table exists
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. profiles (Extends auth.users, id = auth.users.id)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  role          user_role NOT NULL DEFAULT 'employee',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Circular FK for department head
DO $$ BEGIN
  ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. categories
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (length(trim(name)) >= 2),
  description   TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, department_id)
);

-- 4. complaints
CREATE TABLE IF NOT EXISTS complaints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL CHECK (length(trim(title)) >= 5),
  description   TEXT NOT NULL CHECK (length(trim(description)) >= 20),
  category_id   UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status        complaint_status NOT NULL DEFAULT 'submitted',
  priority      complaint_priority NOT NULL DEFAULT 'medium',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

-- 5. assignments
CREATE TABLE IF NOT EXISTS assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  assigned_to   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one active assignment exists per complaint
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_one_active
  ON assignments (complaint_id)
  WHERE is_active = true;

-- 6. comments
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body          TEXT NOT NULL CHECK (length(trim(body)) >= 1),
  is_internal   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. attachments
CREATE TABLE IF NOT EXISTS attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  file_name     TEXT NOT NULL CHECK (length(trim(file_name)) > 0),
  file_size     INTEGER NOT NULL CHECK (file_size > 0),
  mime_type     TEXT NOT NULL CHECK (length(trim(mime_type)) > 0),
  storage_path  TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. status_history
CREATE TABLE IF NOT EXISTS status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  from_status   complaint_status,
  to_status     complaint_status NOT NULL,
  changed_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      UUID,
  action     TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  row_id     UUID NOT NULL,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  complaint_id  UUID REFERENCES complaints(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body          TEXT NOT NULL CHECK (length(trim(body)) > 0),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

