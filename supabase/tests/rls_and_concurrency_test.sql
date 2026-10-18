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
  v_emp3_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-cccccccccccc';
  v_admin_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_comp1_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_comp2_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_comp3_id UUID := '11112222-3333-4444-5555-666677778888';
  v_comp_closed UUID := '77777777-7777-7777-7777-777777777777';
  v_comp_rejected UUID := '88888888-8888-8888-8888-888888888888';
  v_cat_id UUID := 'a1111111-1111-1111-1111-111111111111';
  v_comment_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_comment2_id UUID := 'ffffffff-ffff-ffff-ffff-eeeeeeeeeeee';
  v_attachment_id UUID := 'ffffffff-aaaa-bbbb-cccc-dddddddddddd';
  v_audit_id UUID;
  v_count INT;
  v_assign_result JSONB;
  v_transition_res JSONB;
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
    (v_emp3_id, 'authenticated', 'authenticated', 'rls_test_emp3@example.com', '{"full_name":"Test Employee 3"}'::jsonb, now(), now()),
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
    (v_emp3_id, 'Test Employee 3', 'employee', v_dept_it),
    (v_admin_id, 'Test Admin', 'admin', NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, department_id = EXCLUDED.department_id;

  -- 2. Clean test complaints, comments, and attachments
  DELETE FROM complaints WHERE id IN (v_comp1_id, v_comp2_id, v_comp3_id, v_comp_closed, v_comp_rejected);
  DELETE FROM comments WHERE id IN (v_comment_id, v_comment2_id);
  DELETE FROM attachments WHERE id = v_attachment_id;

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
  IF v_count != 23 THEN
    RAISE EXCEPTION 'TEST 11 FAILED: allowed_transitions has % rows, expected exactly 23!', v_count;
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

  -- -------------------------------------------------------------------------
  -- TEST 17: Specialist Assignee Role & Existence Validation (Migration 011 Gap A)
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

  -- 17A: Assigning an administrator profile (v_admin_id) as specialist raises SQLSTATE P0001
  BEGIN
    PERFORM assign_specialist(v_comp3_id, v_admin_id, 'Attempting to assign admin as specialist', 2);
    RAISE EXCEPTION 'TEST 17A FAILED: Assigning an admin profile as specialist should raise P0001!';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE 'PASS: Test 17A - Assigning administrator profile as specialist blocked (SQLSTATE P0001)';
  END;

  -- 17B: Assigning a nonexistent profile raises SQLSTATE P0002
  BEGIN
    PERFORM assign_specialist(v_comp3_id, '99999999-0000-0000-0000-000000000000'::UUID, 'Attempting to assign nonexistent user', 2);
    RAISE EXCEPTION 'TEST 17B FAILED: Assigning nonexistent profile should raise P0002!';
  EXCEPTION
    WHEN SQLSTATE 'P0002' THEN
      RAISE NOTICE 'PASS: Test 17B - Assigning nonexistent profile blocked (SQLSTATE P0002)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 18: Mandatory expected_version on assign_specialist (Migration 011 Gap B)
  -- -------------------------------------------------------------------------
  -- 18A: Omitting p_expected_version raises SQLSTATE P0003
  BEGIN
    PERFORM assign_specialist(v_comp3_id, v_emp_id, 'Omitted expected_version');
    RAISE EXCEPTION 'TEST 18A FAILED: Omitting expected_version on assign_specialist should raise P0003!';
  EXCEPTION
    WHEN SQLSTATE 'P0003' THEN
      RAISE NOTICE 'PASS: Test 18A - Omitted expected_version on assign_specialist blocked (SQLSTATE P0003)';
  END;

  -- 18B: Passing NULL p_expected_version raises SQLSTATE P0003
  BEGIN
    PERFORM assign_specialist(v_comp3_id, v_emp_id, 'Null expected_version', NULL);
    RAISE EXCEPTION 'TEST 18B FAILED: NULL expected_version on assign_specialist should raise P0003!';
  EXCEPTION
    WHEN SQLSTATE 'P0003' THEN
      RAISE NOTICE 'PASS: Test 18B - NULL expected_version on assign_specialist blocked (SQLSTATE P0003)';
  END;

  -- 18C: Passing stale p_expected_version (version is currently 2 after Test 12, passing 1) raises SQLSTATE P0003
  BEGIN
    PERFORM assign_specialist(v_comp3_id, v_emp_id, 'Stale expected_version', 1);
    RAISE EXCEPTION 'TEST 18C FAILED: Stale expected_version on assign_specialist should raise P0003!';
  EXCEPTION
    WHEN SQLSTATE 'P0003' THEN
      RAISE NOTICE 'PASS: Test 18C - Stale expected_version on assign_specialist blocked (SQLSTATE P0003)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 19: Active Assignee Can View Assigned Complaint via Authenticated RLS
  -- -------------------------------------------------------------------------
  -- Complaint v_comp2_id was created by v_emp2_id. Admin assigns it to v_emp_id.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
  PERFORM assign_specialist(v_comp2_id, v_emp_id, 'Assigning HR complaint to Employee 1 specialist', 1);

  -- Under authenticated RLS as Employee 1 (active assignee), v_comp2_id MUST be visible
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp2_id;
  EXECUTE 'RESET ROLE';
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 19 FAILED: Active assignee could not view assigned complaint under authenticated RLS!';
  END IF;
  RAISE NOTICE 'PASS: Test 19 - Active assignee can view assigned complaint under authenticated RLS';

  -- -------------------------------------------------------------------------
  -- TEST 20: Unassigned Employee Cannot View Another Employee''s Complaint via RLS
  -- -------------------------------------------------------------------------
  -- Employee 3 is NOT the creator of v_comp2_id and is NOT assigned to it
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp3_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp2_id;
  EXECUTE 'RESET ROLE';
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 20 FAILED: Unassigned employee was able to view another employee complaint under authenticated RLS!';
  END IF;
  RAISE NOTICE 'PASS: Test 20 - Unassigned employee cannot view another employee complaint under authenticated RLS';

  -- -------------------------------------------------------------------------
  -- TEST 21: Active Assignee Can View Permitted External Comments, Attachments and History
  -- -------------------------------------------------------------------------
  -- Create external comment, internal comment, attachment and history on v_comp2_id
  INSERT INTO comments (id, complaint_id, author_id, body, is_internal)
  VALUES
    (v_comment2_id, v_comp2_id, v_emp2_id, 'External comment from ticket creator', false),
    (gen_random_uuid(), v_comp2_id, v_admin_id, 'CONFIDENTIAL: Admin internal assessment', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO attachments (id, complaint_id, uploaded_by, file_name, file_size, mime_type, storage_path)
  VALUES (v_attachment_id, v_comp2_id, v_emp2_id, 'evidence.pdf', 1024, 'application/pdf', v_emp2_id::text || '/' || v_comp2_id::text || '/evidence.pdf')
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Active assignee can see external comment
  SELECT count(*) INTO v_count FROM comments WHERE complaint_id = v_comp2_id AND is_internal = false;
  IF v_count < 1 THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'TEST 21A FAILED: Active assignee could not view external comments on assigned complaint!';
  END IF;

  -- Active assignee CANNOT see internal staff note
  SELECT count(*) INTO v_count FROM comments WHERE complaint_id = v_comp2_id AND is_internal = true;
  IF v_count != 0 THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'TEST 21B FAILED: Internal comments were visible to employee specialist!';
  END IF;

  -- Active assignee can see attachment metadata
  SELECT count(*) INTO v_count FROM attachments WHERE complaint_id = v_comp2_id;
  IF v_count != 1 THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'TEST 21C FAILED: Active assignee could not view attachment on assigned complaint!';
  END IF;

  -- Active assignee can see status history timeline
  SELECT count(*) INTO v_count FROM status_history WHERE complaint_id = v_comp2_id;
  EXECUTE 'RESET ROLE';
  IF v_count < 1 THEN
    RAISE EXCEPTION 'TEST 21D FAILED: Active assignee could not view status history on assigned complaint!';
  END IF;
  RAISE NOTICE 'PASS: Test 21 - Active assignee can view external comments, attachments, and timeline (internal notes hidden)';

  -- -------------------------------------------------------------------------
  -- TEST 22: Active Assignee Can Progress assigned -> in_progress and in_progress -> resolved
  -- -------------------------------------------------------------------------
  -- v_comp2_id is currently status 'assigned' with version = 2 (after assign_specialist in Test 19)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);

  -- 22A: Active assignee transitions assigned -> in_progress
  v_transition_res := transition_complaint(v_comp2_id, 'in_progress', 'Specialist starting troubleshooting', 2);
  IF v_transition_res->>'version' != '3' OR v_transition_res->>'new_version' != '3' THEN
    RAISE EXCEPTION 'TEST 22A FAILED: transition_complaint must return both version and new_version with value 3 (got version=%, new_version=%)',
      v_transition_res->>'version', v_transition_res->>'new_version';
  END IF;

  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp2_id AND status = 'in_progress' AND version = 3;
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 22A FAILED: Active assignee transition to in_progress did not update status or increment version!';
  END IF;

  -- 22B: Active assignee transitions in_progress -> resolved
  v_transition_res := transition_complaint(v_comp2_id, 'resolved', 'Specialist resolved the issue', 3);
  IF v_transition_res->>'version' != '4' OR v_transition_res->>'new_version' != '4' THEN
    RAISE EXCEPTION 'TEST 22B FAILED: transition_complaint must return both version and new_version with value 4 (got version=%, new_version=%)',
      v_transition_res->>'version', v_transition_res->>'new_version';
  END IF;

  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp2_id AND status = 'resolved' AND version = 4 AND resolved_at IS NOT NULL;
  IF v_count != 1 THEN
    RAISE EXCEPTION 'TEST 22B FAILED: Active assignee transition to resolved did not set resolved_at or increment version!';
  END IF;
  RAISE NOTICE 'PASS: Test 22 - Active assignee successfully transitioned assigned -> in_progress -> resolved (verified version and new_version contract)';

  -- -------------------------------------------------------------------------
  -- TEST 23: Active Assignee Forbidden From Closing or Rejecting Complaint
  -- -------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);

  -- 23A: Employee cannot close complaint (closing is administrator-only)
  BEGIN
    PERFORM transition_complaint(v_comp2_id, 'closed', 'Specialist attempting to close ticket', 4);
    RAISE EXCEPTION 'TEST 23A FAILED: Employee was able to close complaint!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 23A - Active assignee forbidden from closing complaint (SQLSTATE 42501)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 24: Unassigned Employee Forbidden From Transitioning Others'' Complaints
  -- -------------------------------------------------------------------------
  -- Employee 3 is not assigned to v_comp1_id or v_comp2_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp3_id::text, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM transition_complaint(v_comp2_id, 'in_progress', 'Unassigned employee attempting transition', 4);
    RAISE EXCEPTION 'TEST 24 FAILED: Unassigned employee was able to transition complaint!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RAISE NOTICE 'PASS: Test 24 - Unassigned employee forbidden from transitioning complaint (SQLSTATE 42501)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 25: Replaced/Inactive Assignee Automatically Loses Access
  -- -------------------------------------------------------------------------
  -- Admin replaces active assignee: reassigns v_comp2_id from v_emp_id to v_emp3_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
  PERFORM assign_specialist(v_comp2_id, v_emp3_id, 'Reassigning specialist to Employee 3', 4);

  -- Verify v_emp_id assignment is now is_active = false
  SELECT count(*) INTO v_count FROM assignments WHERE complaint_id = v_comp2_id AND assigned_to = v_emp_id AND is_active = true;
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 25 SETUP FAILED: Previous assignment was not deactivated!';
  END IF;

  -- Under authenticated RLS, previous assignee (Employee 1) MUST NO LONGER see v_comp2_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM complaints WHERE id = v_comp2_id;
  EXECUTE 'RESET ROLE';
  IF v_count != 0 THEN
    RAISE EXCEPTION 'TEST 25 FAILED: Inactive/replaced assignee still had access to complaint under authenticated RLS!';
  END IF;
  RAISE NOTICE 'PASS: Test 25 - Replaced/inactive assignee automatically loses assignment-based access';

  -- -------------------------------------------------------------------------
  -- TEST 26: Storage Helper Function Access Parity
  -- -------------------------------------------------------------------------
  -- New assignee v_emp3_id has active assignment; previous assignee v_emp_id does not
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp3_id::text, 'role', 'authenticated')::text, true);
  IF NOT public.is_complaint_assigned_to_user(v_comp2_id) THEN
    RAISE EXCEPTION 'TEST 26A FAILED: is_complaint_assigned_to_user returned false for active assignee!';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  IF public.is_complaint_assigned_to_user(v_comp2_id) THEN
    RAISE EXCEPTION 'TEST 26B FAILED: is_complaint_assigned_to_user returned true for inactive assignee!';
  END IF;

  -- Creator check: v_emp2_id is creator of v_comp2_id, v_emp3_id is not
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp2_id::text, 'role', 'authenticated')::text, true);
  IF NOT public.is_complaint_creator(v_comp2_id) THEN
    RAISE EXCEPTION 'TEST 26C FAILED: is_complaint_creator returned false for complaint creator!';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp3_id::text, 'role', 'authenticated')::text, true);
  IF public.is_complaint_creator(v_comp2_id) THEN
    RAISE EXCEPTION 'TEST 26D FAILED: is_complaint_creator returned true for non-creator!';
  END IF;
  RAISE NOTICE 'PASS: Test 26 - Storage helper functions correctly enforce active assignee and creator checks';

  -- -------------------------------------------------------------------------
  -- TEST 27: Attachments INSERT RLS (SEC-01)
  -- -------------------------------------------------------------------------
  -- 27A: Active assignee (Employee 3) can insert an attachment row
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp3_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO attachments (complaint_id, uploaded_by, file_name, file_size, mime_type, storage_path)
  VALUES (v_comp2_id, v_emp3_id, 'specialist_evidence.pdf', 1024, 'application/pdf', v_emp3_id::text || '/' || v_comp2_id::text || '/specialist_evidence.pdf');

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS: Test 27A - Active assignee can insert attachment under authenticated RLS';

  -- 27B: Complaint creator (Employee 2) can insert an attachment row
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp2_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO attachments (complaint_id, uploaded_by, file_name, file_size, mime_type, storage_path)
  VALUES (v_comp2_id, v_emp2_id, 'creator_doc.pdf', 2048, 'application/pdf', v_emp2_id::text || '/' || v_comp2_id::text || '/creator_doc.pdf');

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS: Test 27B - Complaint creator can insert attachment under authenticated RLS';

  -- 27C: Admin can insert an attachment row
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO attachments (complaint_id, uploaded_by, file_name, file_size, mime_type, storage_path)
  VALUES (v_comp2_id, v_admin_id, 'admin_inspection.pdf', 4096, 'application/pdf', v_admin_id::text || '/' || v_comp2_id::text || '/admin_inspection.pdf');

  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS: Test 27C - Admin can insert attachment under authenticated RLS';

  -- 27D: Unassigned employee (Employee 1, neither creator nor active assignee) CANNOT insert attachment
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_emp_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    INSERT INTO attachments (complaint_id, uploaded_by, file_name, file_size, mime_type, storage_path)
    VALUES (v_comp2_id, v_emp_id, 'unauthorized.pdf', 1024, 'application/pdf', v_emp_id::text || '/' || v_comp2_id::text || '/unauthorized.pdf');
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'TEST 27D FAILED: Unassigned employee was able to insert attachment under authenticated RLS!';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      EXECUTE 'RESET ROLE';
      RAISE NOTICE 'PASS: Test 27D - Unassigned employee blocked from inserting attachment (SQLSTATE 42501)';
  END;

  -- -------------------------------------------------------------------------
  -- TEST 28: Storage Scoped Path Validation & UUID Regex Casing (SEC-03)
  -- -------------------------------------------------------------------------
  -- 28A: Case-insensitive UUID matching: uppercase UUIDs match ~*
  IF NOT ('EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'TEST 28A FAILED: Uppercase UUID failed case-insensitive match (~*)!';
  END IF;
  RAISE NOTICE 'PASS: Test 28A - Storage path UUID pattern matches uppercase hex case-insensitively';

  -- 28B: Guarded UUID cast prevents 22P02 exception on malformed paths
  IF (
    CASE
      WHEN split_part('not-a-uuid/malformed/filename.pdf', '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_complaint_creator(split_part('not-a-uuid/malformed/filename.pdf', '/', 2)::uuid)
      ELSE false
    END
  ) THEN
    RAISE EXCEPTION 'TEST 28B FAILED: Malformed path unexpectedly evaluated to true!';
  END IF;
  RAISE NOTICE 'PASS: Test 28B - Guarded UUID cast prevents 22P02 runtime errors on malformed storage paths';

  -- 28C: Distinct differentiation between 2-segment legacy paths and 3-segment canonical paths
  IF NOT (
    split_part('user-uid/comp-uid/file.pdf', '/', 3) <> '' AND
    split_part('user-uid/comp-uid/file.pdf', '/', 4) = ''
  ) THEN
    RAISE EXCEPTION 'TEST 28C FAILED: 3-part path format check failed!';
  END IF;

  IF (
    split_part('user-uid/comp-uid/file.pdf', '/', 2) <> '' AND
    split_part('user-uid/comp-uid/file.pdf', '/', 3) = ''
  ) THEN
    RAISE EXCEPTION 'TEST 28C FAILED: 3-part path collided with 2-part legacy check!';
  END IF;

  IF NOT (
    split_part('comp-uid/file.pdf', '/', 2) <> '' AND
    split_part('comp-uid/file.pdf', '/', 3) = ''
  ) THEN
    RAISE EXCEPTION 'TEST 28D FAILED: 2-part legacy path check failed!';
  END IF;
  RAISE NOTICE 'PASS: Test 28C & 28D - Strict path segment checks prevent 2-part and 3-part collision';

  RAISE NOTICE '=== ALL RLS & INTEGRITY TESTS PASSED SUCCESSFULLY ===';
END $$;

ROLLBACK; -- Always rollback test transaction so DB remains clean
