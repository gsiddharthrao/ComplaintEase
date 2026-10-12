-- ============================================================
-- Migration 011: Specialist Assignment Role & OCC Hardening
-- Purpose:
--   1. Enforce at the PostgreSQL boundary that only profiles with
--      role = 'employee' may be assigned as specialists in
--      public.assign_specialist() (rejecting admin or unauthorized
--      target profiles with SQLSTATE P0001, and nonexistent profiles
--      with SQLSTATE P0002).
--   2. Require p_expected_version in public.assign_specialist(),
--      rejecting NULL or < 1 versions with SQLSTATE P0003 instead
--      of bypassing Optimistic Concurrency Control (OCC).
--   3. Preserve SELECT ... FOR UPDATE row locking, terminal state
--      guard (closed/rejected -> P0001), atomic assignment swap,
--      automatic triage status transition, SECURITY DEFINER
--      search_path hardening, and explicit EXECUTE privilege grants.
-- ============================================================

BEGIN;

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
    'version', v_new_version
  );
END;
$$;

-- Preserve explicit function execution privileges
REVOKE ALL ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_specialist(UUID, UUID, TEXT, INTEGER) TO service_role;

COMMIT;

