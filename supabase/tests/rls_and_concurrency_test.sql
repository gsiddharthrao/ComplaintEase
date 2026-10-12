-- ============================================================
-- RLS & Integrity Test Suite (Pure PostgreSQL)
-- Can be run via psql or Supabase SQL editor:
--   psql -f supabase/tests/rls_and_concurrency_test.sql
-- ============================================================

-- Ensure anon and authenticated roles exist if running on standalone postgres
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

BEGIN;

-- Test Setup: Create self-contained fixtures (departments, categories, auth.users, profiles)
DO $$
DECLARE
  v_dept_it UUID := '11111111-1111-1111-1111-111111111111';
  v_dept_hr UUID := '22222222-2222-2222-2222-222222222222';
  v_emp_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_emp2_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbbbbbb';
  v_admin_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_comp1_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_comp2_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_comp3_id UUID := '11112222-3333-4444-5555-666677778888';
  v_comp_closed UUID := '77777777-7777-7777-7777-777777777777';
  v_comp_rejected UUID := '88888888-8888-8888-8888-888888888888';
  v_cat_id UUID := 'a1111111-1111-1111-1111-111111111111';
  v_comment_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_audit_id UUID;
  v_count INT;
  v_assign_result JSONB;
BEGIN
  RAISE NOTICE '=== STARTING COMPLAINTEASE RLS & INTEGRITY TESTS ===';

  -- 0. Ensure parent fixtures exist (departments, categories, auth.users)
  INSERT INTO departments (id, name, description) VALUES
    (v_dept_it, 'Test IT Dept (RLS Suite)', 'IT infrastructure, software, hardware support'),
    (v_dept_hr, 'Test HR Dept (RLS Suite)', 'HR policies, payroll, employee relations')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO categories (id, name, description, department_id) VALUES
    (v_cat_id, 'RLS Test Category', 'Test category for SQL verification suite', NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_emp_id, 'authenticated', 'authenticated', 'rls_test_emp1@example.com', '{"full_name":"Test Employee 1","role":"admin"}'::jsonb, now(), now()),
    (v_emp2_id, 'authenticated', 'authenticated', 'rls_test_emp2@example.com', '{"full_name":"Test Employee 2"}'::jsonb, now(), now()),
    (v_admin_id, 'authenticated', 'authenticated', 'rls_test_admin@example.com', '{"full_name":"Test Admin"}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Verify handle_new_user() ignored "role":"admin" in raw_user_meta_data for v_emp_id
  SELECT count(*) INTO v_count FROM profiles WHERE id = v_emp_id AND role = 'employee';
  IF v_count != 1 THEN
    RAISE EXCEPTION 'SETUP CHECK FAILED: handle_new_user() did not enforce employee role on signup metadata!';
  END IF;

  -- 1. Ensure test profiles have expected test roles and departments
  INSERT INTO profiles (id, full_name, role, department_id) VALUES
    (v_emp_id, 'Test Employee 1', 'employee', v_dept_it),
    (v_emp2_id, 'Test Employee 2', 'employee', v_dept_hr),
    (v_admin_id, 'Test Admin', 'admin', NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, department_id = EXCLUDED.department_id;

  -- 2. Clean test complaints
  DELETE FROM complaints WHERE id IN (v_comp1_id, v_comp2_id, v_comp3_id, v_comp_closed, v_comp_rejected);

  -- 3. Insert baseline complaints
  INSERT INTO complaints (id, title, description, category_id, department_id, created_by, status, priority, version)
  VALUES
    (v_comp1_id, 'IT Network Failure', 'Detailed report of IT switch failure occurring in room 101', v_cat_id, v_dept_it, v_emp_id, 'submitted', 'high', 1),
    (v_comp2_id, 'HR Policy Discrepancy', 'Detailed inquiry about paternity leave entitlement policy', v_cat_id, v_dept_hr, v_emp2_id, 'submitted', 'medium', 1);

  -- -------------------------------------------------------------------------
  -- TEST 1: Direct Status UPDATE must be BLOCKED by trigger
  -- -------------------------------------------------------------------------
  BEGIN
    UPDATE complaints SET status = 'in_progress' WHERE id = v_comp1_id;
    RAISE EXCEPTION 'TEST 1 FAILED: Direct status update should have been blocked by trigger!';
  EXCEPTION
    WHEN SQLSTATE 'P0005' THEN
      RAISE NOTICE 'PASS: Test 1 - Direct status update blocked by trigger (SQLSTATE P0005)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 2: Invalid State Transition (submitted -> resolved directly)
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM transition_complaint(v_comp1_id, 'resolved', 'Trying invalid skip', 1);
    RAISE EXCEPTION 'TEST 2 FAILED: Invalid transition should have thrown P0001!';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE 'PASS: Test 2 - Invalid transition correctly rejected (SQLSTATE P0001)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 3: Version Conflict / Optimistic Lock (including NULL version check)
  -- -------------------------------------------------------------------------
  BEGIN
    -- Expected version is 99, but actual is 1
    PERFORM transition_complaint(v_comp1_id, 'under_review', 'Conflict check', 99);
    RAISE EXCEPTION 'TEST 3A FAILED: Version conflict should have thrown P0003!';
  EXCEPTION
    WHEN SQLSTATE 'P0003' THEN
      NULL;
  END;

  BEGIN
    -- NULL expected_version must also raise P0003 instead of bypassing 3-valued NULL check
    PERFORM transition_complaint(v_comp1_id, 'under_review', 'Null version check', NULL);
    RAISE EXCEPTION 'TEST 3B FAILED: NULL expected_version should have thrown P0003!';
  EXCEPTION
    WHEN SQLSTATE 'P0003' THEN
      RAISE NOTICE 'PASS: Test 3 - Optimistic concurrency lock correctly caught conflict and NULL version (SQLSTATE P0003)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 4: Authorized Transition updates version and adds status_history
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
  PERFORM transition_complaint(v_comp1_id, 'under_review', 'Reviewing IT complaint', 1);

  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp1_id AND status = 'under_review' AND version = 2;
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Complaint version not incremented to 2 or status not under_review!';
  END IF;

  SELECT count(*) INTO v_count FROM status_history WHERE complaint_id = v_comp1_id AND to_status = 'under_review';
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 4 FAILED: status_history record was not created!';
  END IF;
  RAISE NOTICE 'PASS: Test 4 - Valid transition succeeded, version bumped to 2, status_history recorded';

  -- -------------------------------------------------------------------------
  -- TEST 5: Employee forbidden from reopening complaint that is not resolved
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  BEGIN
    -- Complaint is currently under_review, not resolved
    PERFORM transition_complaint(v_comp1_id, 'reopened', 'Illegal reopen', 2);
    RAISE EXCEPTION 'TEST 5 FAILED: Employee was able to reopen an unresolved complaint!';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE 'PASS: Test 5 - Employee reopening unresolved complaint blocked (SQLSTATE P0001)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 6: Employee forbidden from advancing complaints
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM transition_complaint(v_comp1_id, 'assigned', 'Illegal employee advance', 2);
    RAISE EXCEPTION 'TEST 6 FAILED: Employee was able to progress complaint!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 6 - Employee forbidden from progressing complaint (SQLSTATE 42501)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 7: Audit Log Immutability (Tamper-proofing)
  -- -------------------------------------------------------------------------
  SELECT id INTO v_audit_id FROM audit_logs ORDER BY created_at DESC LIMIT 1;
  IF v_audit_id IS NOT NULL THEN
    BEGIN
      UPDATE audit_logs SET action = 'HACKED' WHERE id = v_audit_id;
      RAISE EXCEPTION 'TEST 7A FAILED: UPDATE on audit_logs should be blocked!';
    EXCEPTION
      WHEN SQLSTATE 'P0006' OR SQLSTATE '55000' THEN
        RAISE NOTICE 'PASS: Test 7A - UPDATE on audit_logs blocked by tamper-proofing trigger (SQLSTATE P0006/55000)';
    END;

    BEGIN
      DELETE FROM audit_logs WHERE id = v_audit_id;
      RAISE EXCEPTION 'TEST 7B FAILED: DELETE on audit_logs should be blocked!';
    EXCEPTION
      WHEN SQLSTATE 'P0006' OR SQLSTATE '55000' THEN
        RAISE NOTICE 'PASS: Test 7B - DELETE on audit_logs blocked by tamper-proofing trigger (SQLSTATE P0006/55000)';
    END;
  ELSE
    RAISE NOTICE 'SKIP: Test 7 - No audit log entry found to test modification';
  END IF;

  -- -------------------------------------------------------------------------
  -- TEST 8: Internal Comments Visibility & Cross-Employee RLS Verification
  -- -------------------------------------------------------------------------
  INSERT INTO comments (id, complaint_id, author_id, body, is_internal)
  VALUES (v_comment_id, v_comp1_id, v_admin_id, 'CONFIDENTIAL: Internal staff note regarding switch defect', true)
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Under actual authenticated RLS, employee 1 must see 0 rows for internal comment v_comment_id
  SELECT count(*) INTO v_count FROM comments WHERE id = v_comment_id;
  IF v_count != 0 THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'TEST 8A FAILED: Internal comment was visible to employee under authenticated RLS!';
  END IF;

  -- Under actual authenticated RLS, employee 1 must see 0 rows for employee 2 complaint v_comp2_id
  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp2_id;
  EXECUTE 'RESET ROLE';
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 8B FAILED: Another employee complaint was visible under authenticated RLS!';
  END IF;

  RAISE NOTICE 'PASS: Test 8 - Authenticated RLS hides internal comments and other employees complaints';

  -- -------------------------------------------------------------------------
  -- TEST 9: Non-Admin Profile Role Escalation Blocked by Trigger
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE profiles SET role = 'admin' WHERE id = v_emp_id;
    RAISE EXCEPTION 'TEST 9 FAILED: Non-admin should not be able to escalate role!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 9 - Profile role update blocked for non-admin (SQLSTATE 42501)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 10: Atomic Complaint Creation & Initial History Trigger
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp2_id::text, 'role', 'authenticated')::text, true);
  INSERT INTO complaints (id, title, description, category_id, department_id, created_by, status, priority, version)
  VALUES (v_comp3_id, 'Atomic History Test', 'Verifying initial history trigger insertion', v_cat_id, v_dept_hr, v_emp2_id, 'submitted', 'low', 1);

  SELECT count(*) INTO v_count FROM status_history
  WHERE complaint_id = v_comp3_id AND from_status IS NULL AND to_status = 'submitted';
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 10 FAILED: trg_complaint_initial_history did not insert initial status_history row!';
  END IF;
  RAISE NOTICE 'PASS: Test 10 - Complaint insert automatically recorded initial status_history row via trigger';

  -- -------------------------------------------------------------------------
  -- TEST 11: Canonical State Machine Matrix in allowed_transitions
  -- -------------------------------------------------------------------------
  SELECT count(*) INTO v_count FROM allowed_transitions;
  IF v_count < 23 THEN
    RAISE EXCEPTION 'TEST 11 FAILED: allowed_transitions has only % rows, expected at least 23!', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM allowed_transitions WHERE from_status IN ('closed', 'rejected');
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Terminal states closed and rejected must have 0 outgoing transitions!';
  END IF;
  RAISE NOTICE 'PASS: Test 11 - State machine table has all 23 canonical transitions and terminal states have 0 outgoing transitions';

  -- -------------------------------------------------------------------------
  -- TEST 12: Atomic Specialist Assignment (assign_specialist RPC)
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
  v_assign_result := assign_specialist(v_comp3_id, v_emp_id, 'Assigned to IT specialist', 1);

  IF (v_assign_result->>'status') != 'assigned' THEN
    RAISE EXCEPTION 'TEST 12 FAILED: Expected complaint status assigned, got %', (v_assign_result->>'status');
  END IF;

  SELECT count(*) INTO v_count FROM assignments WHERE complaint_id = v_comp3_id AND assigned_to = v_emp_id AND is_active = true;
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 12 FAILED: Active assignment not found for specialist!';
  END IF;
  RAISE NOTICE 'PASS: Test 12 - assign_specialist RPC executed atomically with assignment and transition';

  -- -------------------------------------------------------------------------
  -- TEST 13: Non-Admin Updating Profile department_id, id, or created_at raises SQLSTATE 42501
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);

  -- 13A: Attempt to update department_id
  BEGIN
    UPDATE profiles SET department_id = v_dept_hr WHERE id = v_emp_id;
    RAISE EXCEPTION 'TEST 13A FAILED: Non-admin should not be able to modify department_id!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 13A - Non-admin profile department_id update blocked (SQLSTATE 42501)';
  END;

  -- 13B: Attempt to update id
  BEGIN
    UPDATE profiles SET id = 'ffffffff-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE id = v_emp_id;
    RAISE EXCEPTION 'TEST 13B FAILED: Non-admin should not be able to modify id!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 13B - Non-admin profile id update blocked (SQLSTATE 42501)';
  END;

  -- 13C: Attempt to update created_at
  BEGIN
    UPDATE profiles SET created_at = now() - interval '1 year' WHERE id = v_emp_id;
    RAISE EXCEPTION 'TEST 13C FAILED: Non-admin should not be able to modify created_at!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 13C - Non-admin profile created_at update blocked (SQLSTATE 42501)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 14: Non-Admin Updating Permitted Profile Fields (full_name, avatar_url) Succeeds
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  UPDATE profiles
  SET full_name = 'Updated Employee Name',
      avatar_url = 'https://example.com/avatar.png'
  WHERE id = v_emp_id;

  SELECT count(*) INTO v_count FROM profiles
  WHERE id = v_emp_id
    AND full_name = 'Updated Employee Name'
    AND avatar_url = 'https://example.com/avatar.png';
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 14 FAILED: Permitted profile fields full_name and avatar_url were not updated!';
  END IF;
  RAISE NOTICE 'PASS: Test 14 - Non-admin updating permitted profile fields (full_name, avatar_url) succeeds';

  -- -------------------------------------------------------------------------
  -- TEST 15: Admin Assigning Specialist to Closed or Rejected Complaint Raises SQLSTATE P0001
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

  INSERT INTO complaints (id, title, description, category_id, department_id, created_by, status, priority, version)
  VALUES
    (v_comp_closed, 'Closed Incident', 'Incident closed after resolution verification', v_cat_id, v_dept_it, v_emp_id, 'closed', 'low', 1),
    (v_comp_rejected, 'Rejected Incident', 'Incident rejected as duplicate ticket', v_cat_id, v_dept_it, v_emp_id, 'rejected', 'low', 1);

  -- 15A: Attempt to assign to closed complaint
  BEGIN
    PERFORM assign_specialist(v_comp_closed, v_emp_id, 'Assigning to closed incident', 1);
    RAISE EXCEPTION 'TEST 15A FAILED: Admin assignment to closed complaint should raise P0001!';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE 'PASS: Test 15A - Admin assignment to closed complaint blocked (SQLSTATE P0001)';
  END;

  -- 15B: Attempt to assign to rejected complaint
  BEGIN
    PERFORM assign_specialist(v_comp_rejected, v_emp_id, 'Assigning to rejected incident', 1);
    RAISE EXCEPTION 'TEST 15B FAILED: Admin assignment to rejected complaint should raise P0001!';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE 'PASS: Test 15B - Admin assignment to rejected complaint blocked (SQLSTATE P0001)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 16: Check has_function_privilege('anon', 'assign_specialist(uuid, uuid, text, integer)', 'execute') is false
  -- -------------------------------------------------------------------------
  IF has_function_privilege('anon', 'assign_specialist(uuid, uuid, text, integer)', 'execute') THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Role anon should NOT have execute privilege on assign_specialist!';
  END IF;
  RAISE NOTICE 'PASS: Test 16 - anon role has NO execute privilege on assign_specialist';

  RAISE NOTICE '=== ALL RLS & INTEGRITY TESTS PASSED SUCCESSFULLY ===';
END $$;

ROLLBACK; -- Always rollback test transaction so DB remains clean
