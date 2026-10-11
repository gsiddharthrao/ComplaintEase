-- ============================================================
-- Migration 010: Security, Workflow, and Concurrency Hardening
-- ============================================================

-- ------------------------------------------------------------
-- 1. Role Provisioning Hardening (R2.1)
-- Ensure public signup unconditionally assigns 'employee'
-- and completely ignores user-supplied raw_user_meta_data->>'role'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dept UUID := NULL;
  v_meta_dept TEXT;
BEGIN
  -- Strict Security: Unconditionally assign 'employee'.
  -- Never trust raw_user_meta_data->>'role' on self-service signup.
  v_meta_dept := NEW.raw_user_meta_data->>'department_id';

  IF v_meta_dept IS NOT NULL AND v_meta_dept ~ '^[0-9a-fA-F-]{36}$' THEN
    v_dept := v_meta_dept::UUID;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    department_id,
    avatar_url,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'employee',
    v_dept,
    NEW.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    -- Strictly preserve existing role; never escalate via auth user metadata
    role = profiles.role,
    department_id = COALESCE(EXCLUDED.department_id, profiles.department_id),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. Profile Sensitive Column Authorization Trigger (R2.2)
-- Prevent non-admin users from modifying sensitive profile columns
-- (role, department_id, id, created_at)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR
      NEW.department_id IS DISTINCT FROM OLD.department_id OR
      NEW.id IS DISTINCT FROM OLD.id OR
      NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    -- Check if caller is admin or service_role
    IF current_user_role() != 'admin' AND
       current_setting('role', true) != 'service_role' AND
       coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') != 'service_role'
    THEN
      RAISE EXCEPTION 'Non-admin users are strictly forbidden from modifying sensitive profile columns (role, department_id, id, created_at)'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_columns();

DROP FUNCTION IF EXISTS public.protect_profile_role();

-- ------------------------------------------------------------
-- 3. Supabase Storage Hardening (R2.3, R2.4)
-- Drop overly broad legacy policies and enforce scoped path ownership
-- ------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "storage_upload_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_read_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_upload_authenticated" ON storage.objects;
  DROP POLICY IF EXISTS "storage_read_authenticated" ON storage.objects;
  DROP POLICY IF EXISTS "storage_insert_scoped" ON storage.objects;
  DROP POLICY IF EXISTS "storage_select_scoped" ON storage.objects;
  DROP POLICY IF EXISTS "storage_delete_scoped" ON storage.objects;
EXCEPTION WHEN others THEN null; END $$;

-- Scoped upload policy:
-- Path must be <user_id>/<complaint_id>/<filename> or <complaint_id>/<filename>
-- and the caller must own the complaint or be an admin
CREATE POLICY "storage_insert_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments' AND (
      current_user_role() = 'admin' OR
      (
        -- 3-part path convention: <user_id>/<complaint_id>/<filename>
        (
          split_part(name, '/', 1) = auth.uid()::text AND
          EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id::text = split_part(name, '/', 2)
              AND c.created_by = auth.uid()
          )
        )
        OR
        -- 2-part path convention: <complaint_id>/<filename>
        (
          EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id::text = split_part(name, '/', 1)
              AND c.created_by = auth.uid()
          )
        )
      )
    )
  );

-- Scoped read policy:
-- Complaint must belong to caller or caller must be admin
CREATE POLICY "storage_select_scoped"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments' AND (
      current_user_role() = 'admin' OR
      -- 3-part path
      EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id::text = split_part(name, '/', 2)
          AND c.created_by = auth.uid()
      ) OR
      -- 2-part path
      EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id::text = split_part(name, '/', 1)
          AND c.created_by = auth.uid()
      )
    )
  );

-- Scoped delete policy:
-- Complaint must belong to caller or caller must be admin
CREATE POLICY "storage_delete_scoped"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments' AND (
      current_user_role() = 'admin' OR
      (
        -- 3-part path
        split_part(name, '/', 1) = auth.uid()::text AND
        EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id::text = split_part(name, '/', 2)
            AND c.created_by = auth.uid()
        )
      ) OR
      -- 2-part path
      EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id::text = split_part(name, '/', 1)
          AND c.created_by = auth.uid()
      )
    )
  );

-- Publish attachments table to Supabase Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE attachments;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 4. Atomic Complaint Creation & Initial History Trigger (R2.4, R3.3)
-- Automatically records the initial 'submitted' status_history entry on complaint insert
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_initial_complaint_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.status_history (
    complaint_id,
    from_status,
    to_status,
    changed_by,
    note
  ) VALUES (
    NEW.id,
    NULL,
    NEW.status,
    NEW.created_by,
    'Complaint submitted by employee'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_initial_history ON public.complaints;
CREATE TRIGGER trg_complaint_initial_history
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.record_initial_complaint_status_history();

-- ------------------------------------------------------------
-- 5. Canonical State Machine Transitions (R3.1)
-- Synchronize the complete 23 transitions from @complaintease/shared enums.ts
-- ------------------------------------------------------------
DELETE FROM public.allowed_transitions;

INSERT INTO public.allowed_transitions (from_status, to_status) VALUES
  ('submitted',    'under_review'),
  ('submitted',    'assigned'),
  ('submitted',    'in_progress'),
  ('submitted',    'rejected'),
  ('under_review', 'assigned'),
  ('under_review', 'in_progress'),
  ('under_review', 'resolved'),
  ('under_review', 'rejected'),
  ('assigned',     'in_progress'),
  ('assigned',     'resolved'),
  ('assigned',     'closed'),
  ('assigned',     'rejected'),
  ('in_progress',  'resolved'),
  ('in_progress',  'assigned'),
  ('in_progress',  'closed'),
  ('in_progress',  'rejected'),
  ('resolved',     'closed'),
  ('resolved',     'reopened'),
  ('resolved',     'in_progress'),
  ('reopened',     'in_progress'),
  ('reopened',     'assigned'),
  ('reopened',     'resolved'),
  ('reopened',     'rejected');

-- Enforce terminal states closed and rejected have zero outgoing transitions
DELETE FROM public.allowed_transitions
WHERE from_status IN ('closed', 'rejected');

-- ------------------------------------------------------------
-- 6. Atomic Specialist Assignment Stored Function (R3.2)
-- Executes row locking, admin check, terminal check, assignee verification,
-- previous assignment deactivation, new assignment insertion,
-- and conditional status transition to 'assigned' atomically.
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
  -- 1. Verify caller is administrator
  v_caller_role := current_user_role();
  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can assign specialists'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Lock complaint row FOR UPDATE
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

  -- 3. Optimistic version check if client specified expected_version
  IF p_expected_version IS NOT NULL AND v_complaint.version != p_expected_version THEN
    RAISE EXCEPTION 'Conflict: expected version %, but current version is %',
      p_expected_version, v_complaint.version
      USING ERRCODE = 'P0003';
  END IF;

  -- 4. Verify target assignee exists in profiles
  SELECT * INTO v_target_profile
  FROM profiles
  WHERE id = p_assigned_to;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user % not found', p_assigned_to
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Deactivate existing active assignments
  UPDATE assignments
  SET is_active = false
  WHERE complaint_id = p_complaint_id
    AND is_active = true;

  -- 6. Insert new assignment
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
    'version', v_new_version
  );
END;
$$;

-- ------------------------------------------------------------
-- 7. Audit Log Tamper-Proofing Error Code Alignment (R4.2)
-- Ensure block_audit_log_modification raises ERRCODE = 'P0006'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log table is append-only. UPDATE and DELETE operations are strictly forbidden.'
    USING ERRCODE = 'P0006';
END;
$$;

-- ------------------------------------------------------------
-- 8. SECURITY DEFINER Privilege Lockdown (R2.3)
-- In PostgreSQL, functions grant EXECUTE to PUBLIC by default.
-- Explicitly revoke ALL from PUBLIC and anon for all SECURITY DEFINER
-- functions, granting EXECUTE only to authenticated callers where intended,
-- and restricting trigger functions strictly from direct invocation.
-- ------------------------------------------------------------

-- A. Public RPC / Helper Functions:
-- Revoke from PUBLIC and anon, grant EXECUTE to authenticated
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_dept() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_dept() TO authenticated;

REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

REVOKE ALL ON FUNCTION public.current_dept() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_dept() TO authenticated;

REVOKE ALL ON FUNCTION public.transition_complaint(UUID, complaint_status, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_complaint(UUID, complaint_status, TEXT, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) TO authenticated;

-- B. Trigger Functions:
-- Revoke EXECUTE from PUBLIC, anon, and authenticated so they cannot be invoked directly via RPC
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_status_via_function() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_initial_complaint_status_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_audit_log_modification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_comment() FROM PUBLIC, anon, authenticated;
