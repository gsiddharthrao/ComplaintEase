-- ============================================================
-- Migration 004: Helper Functions, Allowed Transitions, and transition_complaint()
-- ============================================================

-- Security-definer helpers to avoid recursive RLS evaluations
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION current_user_dept()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT department_id
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_user_dept() TO authenticated, anon;

-- Allowed status transitions table
CREATE TABLE IF NOT EXISTS allowed_transitions (
  from_status complaint_status NOT NULL,
  to_status   complaint_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

INSERT INTO allowed_transitions (from_status, to_status) VALUES
  ('submitted',    'under_review'),
  ('submitted',    'rejected'),
  ('under_review', 'assigned'),
  ('under_review', 'rejected'),
  ('assigned',     'in_progress'),
  ('assigned',     'rejected'),
  ('in_progress',  'resolved'),
  ('in_progress',  'rejected'),
  ('resolved',     'closed'),
  ('resolved',     'reopened'),
  ('reopened',     'in_progress'),
  ('reopened',     'rejected')
ON CONFLICT DO NOTHING;

-- Enforce that status updates must go through transition_complaint()
CREATE OR REPLACE FUNCTION enforce_status_via_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status is not changing, allow regular updates (e.g. title/description edits)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Allow if session flag set by transition_complaint()
  IF current_setting('complaintease.in_transition', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Allow if executed by service_role (e.g. background tasks or seeds)
  IF current_setting('role', true) = 'service_role' OR
     current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Direct UPDATE of complaint status is forbidden. Call transition_complaint(...) instead.'
    USING ERRCODE = 'P0005';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_direct_status_update ON complaints;
CREATE TRIGGER trg_block_direct_status_update
  BEFORE UPDATE ON complaints
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_status_via_function();

-- Main transition function
CREATE OR REPLACE FUNCTION transition_complaint(
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
  v_caller_dept    UUID;
  v_caller_id      UUID := auth.uid();
  v_result         JSONB;
BEGIN
  -- 1. Lock the row with SELECT ... FOR UPDATE to avoid race conditions
  SELECT * INTO v_complaint
  FROM complaints
  WHERE id = p_complaint_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint % not found', p_complaint_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Optimistic locking verification
  IF v_complaint.version != p_expected_version THEN
    RAISE EXCEPTION 'Conflict: expected version %, but current version is %',
      p_expected_version, v_complaint.version
      USING ERRCODE = 'P0003';
  END IF;

  -- 3. Verify valid state machine transition
  IF NOT EXISTS (
    SELECT 1 FROM allowed_transitions
    WHERE from_status = v_complaint.status
      AND to_status = p_new_status
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: cannot change from % to %',
      v_complaint.status, p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Role-based permission verification
  v_caller_role := current_user_role();
  v_caller_dept := current_user_dept();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller'
      USING ERRCODE = '28000';
  END IF;

  IF v_caller_role = 'employee' THEN
    -- Employees can ONLY reopen their own resolved complaints
    IF p_new_status != 'reopened' OR v_complaint.created_by != v_caller_id THEN
      RAISE EXCEPTION 'Employees may only reopen their own resolved complaints'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_caller_role = 'admin' THEN
    -- Admins have global permission
    NULL;
  ELSE
    RAISE EXCEPTION 'Unknown or unauthorized role: %', v_caller_role
      USING ERRCODE = '42501';
  END IF;

  -- 5. Set session flag to bypass direct update trigger
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

  -- Clear session flag
  PERFORM set_config('complaintease.in_transition', 'false', true);

  -- 7. Insert status history entry
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

  v_result := jsonb_build_object(
    'success', true,
    'complaint_id', p_complaint_id,
    'from_status', v_complaint.status,
    'to_status', p_new_status,
    'new_version', v_complaint.version + 1
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION transition_complaint(UUID, complaint_status, TEXT, INTEGER)
  TO authenticated;

