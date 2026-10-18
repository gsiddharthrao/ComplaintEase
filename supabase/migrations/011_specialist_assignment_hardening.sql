-- ============================================================
-- Migration 011: Specialist Assignment Role, OCC, and RLS Workflow Hardening
-- Purpose:
--   1. Enforce at the PostgreSQL boundary that only profiles with
--      role = 'employee' may be assigned as specialists in
--      public.assign_specialist() (rejecting admin or unauthorized
--      target profiles with SQLSTATE P0001, and nonexistent profiles
--      with SQLSTATE P0002).
--   2. Require p_expected_version in public.assign_specialist(),
--      rejecting NULL or < 1 versions with SQLSTATE P0003 instead
--      of bypassing Optimistic Concurrency Control (OCC).
--   3. Enable Assigned-Specialist Workflow across PostgreSQL Row-Level Security:
--      - Active assignees may view complaints assigned to them.
--      - Active assignees may read external comments, permitted attachments,
--        and status history for their assigned complaints.
--      - Active assignees may post external comments and upload evidence
--        to their assigned complaints.
--      - Replaced/inactive assignees automatically lose assignment-based access.
--   4. Non-Recursive Security-Definer Helper Functions:
--      - public.is_complaint_assigned_to_user(UUID)
--      - public.is_complaint_creator(UUID)
--      Both use fixed search_path = public, read auth.uid(), and eliminate
--      cross-table RLS recursion.
--   5. Update public.transition_complaint():
--      - Allows actively assigned employees to perform work transitions:
--        'assigned' -> 'in_progress', and 'in_progress' -> 'resolved'.
--      - Forbids employees from closing, rejecting, or transitioning
--        complaints they are not actively assigned to (SQLSTATE 42501).
--      - Preserves employee reopening of own resolved complaints,
--        admin lifecycle control, and optimistic concurrency version checking.
--   6. Storage Scoped Policies:
--      - Permit active assignees to read and upload attachments to
--        assigned complaint paths while maintaining private bucket isolation.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Non-Recursive Security-Definer Helper Functions
-- ------------------------------------------------------------

-- Returns true if the authenticated user is the active assignee on the complaint
CREATE OR REPLACE FUNCTION public.is_complaint_assigned_to_user(p_complaint_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_complaint_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.assignments
    WHERE complaint_id = p_complaint_id
      AND assigned_to = auth.uid()
      AND is_active = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_complaint_assigned_to_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_complaint_assigned_to_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_complaint_assigned_to_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_complaint_assigned_to_user(UUID) TO service_role;

-- Returns true if the authenticated user created the complaint
CREATE OR REPLACE FUNCTION public.is_complaint_creator(p_complaint_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_complaint_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.complaints
    WHERE id = p_complaint_id
      AND created_by = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_complaint_creator(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_complaint_creator(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_complaint_creator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_complaint_creator(UUID) TO service_role;

-- ------------------------------------------------------------
-- 2. Row Level Security Policies for Assigned Specialists
-- ------------------------------------------------------------

-- 2A. complaints: Employee can see complaints they created OR are actively assigned to
DROP POLICY IF EXISTS "complaints_select_employee" ON public.complaints;
CREATE POLICY "complaints_select_employee"
  ON public.complaints FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND (
      created_by = auth.uid()
      OR public.is_complaint_assigned_to_user(id)
    )
  );

-- 2B. assignments: Employee can see assignments where they are assigned OR created the complaint
DROP POLICY IF EXISTS "assignments_select_employee" ON public.assignments;
CREATE POLICY "assignments_select_employee"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND (
      assigned_to = auth.uid()
      OR public.is_complaint_creator(complaint_id)
    )
  );

-- 2C. comments: Employee sees external comments if creator OR active assignee
DROP POLICY IF EXISTS "comments_select_employee" ON public.comments;
CREATE POLICY "comments_select_employee"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND is_internal = false
    AND (
      public.is_complaint_creator(complaint_id)
      OR public.is_complaint_assigned_to_user(complaint_id)
    )
  );

-- Employee can insert external comments if creator OR active assignee
DROP POLICY IF EXISTS "comments_insert_employee" ON public.comments;
CREATE POLICY "comments_insert_employee"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'employee'
    AND author_id = auth.uid()
    AND is_internal = false
    AND (
      public.is_complaint_creator(complaint_id)
      OR public.is_complaint_assigned_to_user(complaint_id)
    )
  );

-- 2D. attachments: Employee sees attachments if creator OR active assignee
DROP POLICY IF EXISTS "attachments_select_employee" ON public.attachments;
CREATE POLICY "attachments_select_employee"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND (
      public.is_complaint_creator(complaint_id)
      OR public.is_complaint_assigned_to_user(complaint_id)
    )
  );

-- Employee and Admin can insert attachments (SEC-01)
-- Drop all legacy and previous policy names to avoid permissive policy conflict
DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
DROP POLICY IF EXISTS "attachments_insert_employee" ON public.attachments;
DROP POLICY IF EXISTS "attachments_insert_authenticated" ON public.attachments;

CREATE POLICY "attachments_insert_authenticated"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      current_user_role() = 'admin'
      OR (
        current_user_role() = 'employee'
        AND (
          public.is_complaint_creator(complaint_id)
          OR public.is_complaint_assigned_to_user(complaint_id)
        )
      )
    )
  );

-- 2E. status_history: Employee sees timeline if creator OR active assignee
DROP POLICY IF EXISTS "status_history_select_employee" ON public.status_history;
CREATE POLICY "status_history_select_employee"
  ON public.status_history FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND (
      public.is_complaint_creator(complaint_id)
      OR public.is_complaint_assigned_to_user(complaint_id)
    )
  );

-- 2F. storage.objects: Scoped upload, select and delete for active assignees (SEC-03)
DO $$ BEGIN
  DROP POLICY IF EXISTS "storage_insert_scoped" ON storage.objects;
  DROP POLICY IF EXISTS "storage_select_scoped" ON storage.objects;
  DROP POLICY IF EXISTS "storage_delete_scoped" ON storage.objects;
EXCEPTION WHEN others THEN null; END $$;

CREATE POLICY "storage_insert_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments' AND (
      current_user_role() = 'admin' OR
      (
        split_part(name, '/', 1) = auth.uid()::text AND
        split_part(name, '/', 3) <> '' AND
        split_part(name, '/', 4) = '' AND
        CASE
          WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (
            public.is_complaint_creator(split_part(name, '/', 2)::uuid) OR
            public.is_complaint_assigned_to_user(split_part(name, '/', 2)::uuid)
          )
          ELSE false
        END
      )
    )
  );

CREATE POLICY "storage_select_scoped"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments' AND (
      current_user_role() = 'admin' OR
      -- 3-part canonical path: <uploader_uid>/<complaint_id>/<filename>
      (
        split_part(name, '/', 3) <> '' AND
        split_part(name, '/', 4) = '' AND
        CASE
          WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (
            public.is_complaint_creator(split_part(name, '/', 2)::uuid) OR
            public.is_complaint_assigned_to_user(split_part(name, '/', 2)::uuid)
          )
          ELSE false
        END
      ) OR
      -- 2-part legacy path: <complaint_id>/<filename>
      (
        split_part(name, '/', 2) <> '' AND
        split_part(name, '/', 3) = '' AND
        CASE
          WHEN split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (
            public.is_complaint_creator(split_part(name, '/', 1)::uuid) OR
            public.is_complaint_assigned_to_user(split_part(name, '/', 1)::uuid)
          )
          ELSE false
        END
      )
    )
  );

CREATE POLICY "storage_delete_scoped"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments' AND (
      current_user_role() = 'admin' OR
      (
        split_part(name, '/', 1) = auth.uid()::text AND
        split_part(name, '/', 3) <> '' AND
        split_part(name, '/', 4) = '' AND
        CASE
          WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (
            public.is_complaint_creator(split_part(name, '/', 2)::uuid) OR
            public.is_complaint_assigned_to_user(split_part(name, '/', 2)::uuid)
          )
          ELSE false
        END
      )
    )
  );

-- ------------------------------------------------------------
-- 3. Hardened assign_specialist() Function (Gap A + Gap B)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_specialist(
  p_complaint_id     UUID,
  p_assigned_to      UUID,
  p_note             TEXT DEFAULT NULL,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_complaint      complaints%ROWTYPE;
  v_caller_role    user_role;
  v_caller_id      UUID := auth.uid();
  v_target_profile profiles%ROWTYPE;
  v_assignment_id  UUID;
  v_new_status     complaint_status;
  v_new_version    INTEGER;
BEGIN
  -- 1. Verify caller is administrator (NULL-safe)
  v_caller_role := current_user_role();
  IF v_caller_id IS NULL OR v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators can assign specialists'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Lock complaint row FOR UPDATE to serialize concurrent updates
  SELECT * INTO v_complaint
  FROM complaints
  WHERE id = p_complaint_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint % not found', p_complaint_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2b. Reject assignment on terminal complaints (closed, rejected)
  IF v_complaint.status IN ('closed', 'rejected') THEN
    RAISE EXCEPTION 'Cannot assign specialist to a % complaint', v_complaint.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Mandatory Optimistic Concurrency Control (expected_version required)
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'expected_version is required for specialist assignment'
      USING ERRCODE = 'P0003';
  END IF;

  IF v_complaint.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Conflict: expected version %, but current version is %',
      p_expected_version, v_complaint.version
      USING ERRCODE = 'P0003';
  END IF;

  -- 4. Verify target assignee exists in profiles AND has permitted role ('employee')
  IF p_assigned_to IS NULL THEN
    RAISE EXCEPTION 'Target user % not found', p_assigned_to
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_target_profile
  FROM profiles
  WHERE id = p_assigned_to;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user % not found', p_assigned_to
      USING ERRCODE = 'P0002';
  END IF;

  IF v_target_profile.role IS DISTINCT FROM 'employee' THEN
    RAISE EXCEPTION 'Target assignee % must have role employee (found %)',
      p_assigned_to, v_target_profile.role
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Deactivate existing active assignments
  UPDATE assignments
  SET is_active = false
  WHERE complaint_id = p_complaint_id
    AND is_active = true;

  -- 6. Insert new active assignment
  INSERT INTO assignments (
    complaint_id,
    assigned_to,
    assigned_by,
    is_active,
    note
  ) VALUES (
    p_complaint_id,
    p_assigned_to,
    v_caller_id,
    true,
    p_note
  )
  RETURNING id INTO v_assignment_id;

  -- 7. Execute status transition if in triage stages (submitted or under_review)
  v_new_status := v_complaint.status;
  v_new_version := v_complaint.version;

  IF v_complaint.status IN ('submitted', 'under_review') THEN
    v_new_status := 'assigned';
    v_new_version := v_complaint.version + 1;

    PERFORM set_config('complaintease.in_transition', 'true', true);

    UPDATE complaints
    SET
      status     = 'assigned',
      version    = v_new_version,
      updated_at = now()
    WHERE id = p_complaint_id;

    PERFORM set_config('complaintease.in_transition', 'false', true);

    INSERT INTO status_history (
      complaint_id,
      from_status,
      to_status,
      changed_by,
      note
    ) VALUES (
      p_complaint_id,
      v_complaint.status,
      'assigned',
      v_caller_id,
      COALESCE(p_note, 'Assigned to specialist')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'complaint_id', p_complaint_id,
    'assigned_to', p_assigned_to,
    'status', v_new_status,
    'version', v_new_version,
    'new_version', v_new_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 4. Hardened transition_complaint() Function with Specialist Permissions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_complaint(
  p_complaint_id     UUID,
  p_new_status       complaint_status,
  p_note             TEXT DEFAULT NULL,
  p_expected_version INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_complaint      complaints%ROWTYPE;
  v_caller_role    user_role;
  v_caller_id      UUID := auth.uid();
  v_is_assigned    BOOLEAN;
BEGIN
  -- 1. Lock complaint row FOR UPDATE to serialize concurrent transitions
  SELECT * INTO v_complaint
  FROM complaints
  WHERE id = p_complaint_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint % not found', p_complaint_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. NULL-safe Optimistic Concurrency Control verification
  IF p_expected_version IS NULL OR v_complaint.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Conflict: expected version %, but current version is %',
      p_expected_version, v_complaint.version
      USING ERRCODE = 'P0003';
  END IF;

  -- 3. Verify valid state machine transition against allowed_transitions table
  IF p_new_status IS NULL OR NOT EXISTS (
    SELECT 1 FROM allowed_transitions
    WHERE from_status = v_complaint.status
      AND to_status = p_new_status
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: cannot change from % to %',
      v_complaint.status, p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. NULL-safe role-based permission verification
  v_caller_role := current_user_role();

  IF v_caller_id IS NULL OR v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller'
      USING ERRCODE = '28000';
  END IF;

  IF v_caller_role = 'employee' THEN
    -- Check if caller is the active assignee
    v_is_assigned := public.is_complaint_assigned_to_user(p_complaint_id);

    -- Path A: Creator reopening their own resolved complaint
    IF p_new_status = 'reopened' AND v_complaint.status = 'resolved' AND v_complaint.created_by = v_caller_id THEN
      NULL; -- Allowed
    -- Path B: Active assignee progressing work (assigned -> in_progress OR in_progress -> resolved)
    ELSIF v_is_assigned AND (
      (v_complaint.status = 'assigned' AND p_new_status = 'in_progress') OR
      (v_complaint.status = 'in_progress' AND p_new_status = 'resolved')
    ) THEN
      NULL; -- Allowed
    ELSE
      RAISE EXCEPTION 'Employees may only reopen their own resolved complaints or transition active assigned complaints (assigned -> in_progress -> resolved)'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_caller_role = 'admin' THEN
    NULL; -- Administrator retains full lifecycle transition authority
  ELSE
    RAISE EXCEPTION 'Unknown or unauthorized role: %', v_caller_role
      USING ERRCODE = '42501';
  END IF;

  -- 5. Set session flag to authorize status update trigger
  PERFORM set_config('complaintease.in_transition', 'true', true);

  -- 6. Update complaint row
  UPDATE complaints
  SET
    status      = p_new_status,
    version     = version + 1,
    updated_at  = now(),
    resolved_at = CASE
      WHEN p_new_status = 'resolved' THEN now()
      WHEN p_new_status = 'reopened' THEN NULL
      ELSE resolved_at
    END
  WHERE id = p_complaint_id;

  -- 7. Reset session flag
  PERFORM set_config('complaintease.in_transition', 'false', true);

  -- 8. Append to status_history
  INSERT INTO status_history (
    complaint_id,
    from_status,
    to_status,
    changed_by,
    note
  ) VALUES (
    p_complaint_id,
    v_complaint.status,
    p_new_status,
    v_caller_id,
    p_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'complaint_id', p_complaint_id,
    'from_status', v_complaint.status,
    'to_status', p_new_status,
    'version', v_complaint.version + 1,
    'new_version', v_complaint.version + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_complaint(UUID, complaint_status, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_complaint(UUID, complaint_status, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_complaint(UUID, complaint_status, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_complaint(UUID, complaint_status, TEXT, INTEGER) TO service_role;

COMMIT;
