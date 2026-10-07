-- ============================================================
-- Seed Data & 10,000+ Realistic Complaints Generator
-- ============================================================

-- 1. Fixed Department UUIDs for deterministic testing
INSERT INTO departments (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Information Technology', 'IT infrastructure, systems, network, and software engineering'),
  ('22222222-2222-2222-2222-222222222222', 'Human Resources', 'Talent acquisition, employee welfare, payroll, and company benefits'),
  ('33333333-3333-3333-3333-333333333333', 'Finance & Accounting', 'Invoicing, corporate expense management, and budget allocations'),
  ('44444444-4444-4444-4444-444444444444', 'Facilities & Operations', 'Workplace ergonomics, HVAC, electrical, building security, and sanitation'),
  ('55555555-5555-5555-5555-555555555555', 'Customer Experience', 'Escalations, tier-3 support disputes, and customer contract issues')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 2. Categories
INSERT INTO categories (id, name, description, department_id) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'VPN & Connectivity Outage', 'Issues connecting to corporate networks or cloud VPCs', '11111111-1111-1111-1111-111111111111'),
  ('a2222222-2222-2222-2222-222222222222', 'Hardware Malfunction', 'Broken laptop monitors, docking stations, keyboards', '11111111-1111-1111-1111-111111111111'),
  ('a3333333-3333-3333-3333-333333333333', 'Software Access Permission', 'Access requests to GitHub, AWS IAM, or internal tooling', '11111111-1111-1111-1111-111111111111'),
  ('b1111111-1111-1111-1111-111111111111', 'Payroll Discrepancy', 'Salary delays, missing reimbursements, or tax deductions', '22222222-2222-2222-2222-222222222222'),
  ('b2222222-2222-2222-2222-222222222222', 'Workplace Harassment / Grievance', 'Interpersonal conflicts and policy violations', '22222222-2222-2222-2222-222222222222'),
  ('c1111111-1111-1111-1111-111111111111', 'Expense Report Approval', 'Pending corporate credit card or travel receipts', '33333333-3333-3333-3333-333333333333'),
  ('d1111111-1111-1111-1111-111111111111', 'HVAC / Temperature Regulation', 'Server room or office floor heating/cooling issues', '44444444-4444-4444-4444-444444444444'),
  ('d2222222-2222-2222-2222-222222222222', 'Badge Access Failure', 'Smart card RFID readers not functioning', '44444444-4444-4444-4444-444444444444'),
  ('e1111111-1111-1111-1111-111111111111', 'Customer Escalation Dispute', 'High-priority SLA breach or client complaint', '55555555-5555-5555-5555-555555555555'),
  ('f1111111-1111-1111-1111-111111111111', 'General Inquiry', 'Cross-departmental questions and operational suggestions', NULL)
ON CONFLICT (name, department_id) DO NOTHING;

-- 3. Procedure to generate N realistic complaints for performance testing
CREATE OR REPLACE FUNCTION generate_seed_complaints(p_count INTEGER DEFAULT 10000)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_depts UUID[];
  v_categories UUID[];
  v_statuses complaint_status[] := ARRAY['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened']::complaint_status[];
  v_priorities complaint_priority[] := ARRAY['low', 'medium', 'high', 'critical']::complaint_priority[];
  v_titles TEXT[] := ARRAY[
    'Laptop thermal throttling during build pipeline execution',
    'Intermittent WiFi disconnects in Conference Room C',
    'Reimbursement delayed for Q3 cloud conference tickets',
    'Emergency exit door sensor beeping continuously on floor 4',
    'Database migration access credentials not provisioning',
    'Medical insurance enrollment portal throws 500 error',
    'Customer SLA breached due to unexpected payment gateway timeout',
    'Ergonomic chair request pending approval for three weeks',
    'VPN tunnel dropping packets during customer demo sessions',
    'Company cafeteria contactless payment reader offline'
  ];
BEGIN
  -- Find an employee profile to attribute complaints to
  SELECT id INTO v_user_id FROM profiles WHERE role = 'employee' LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM profiles LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No profile found yet. Skipping complaint generation until users are seeded.';
    RETURN;
  END IF;

  SELECT array_agg(id) INTO v_depts FROM departments;
  SELECT array_agg(id) INTO v_categories FROM categories;

  -- Temporarily disable audit triggers during bulk load for 100x speedup
  ALTER TABLE complaints DISABLE TRIGGER trg_audit_complaints;

  INSERT INTO complaints (
    id,
    title,
    description,
    category_id,
    department_id,
    created_by,
    status,
    priority,
    created_at,
    updated_at,
    resolved_at,
    version
  )
  SELECT
    gen_random_uuid(),
    v_titles[1 + (i % array_length(v_titles, 1))] || ' [Ref #' || i || ']',
    'Automated performance test complaint number ' || i || '. Comprehensive context: The user noticed this regression during regular working hours and requires tier-2 escalation. Timestamp verification code: ' || md5(i::text),
    v_categories[1 + (i % array_length(v_categories, 1))],
    v_depts[1 + (i % array_length(v_depts, 1))],
    v_user_id,
    v_statuses[1 + (i % array_length(v_statuses, 1))],
    v_priorities[1 + (i % array_length(v_priorities, 1))],
    now() - (i || ' minutes')::interval,
    now() - (i || ' minutes')::interval,
    CASE WHEN v_statuses[1 + (i % array_length(v_statuses, 1))] IN ('resolved', 'closed') THEN now() ELSE NULL END,
    1
  FROM generate_series(1, p_count) AS s(i);

  -- Re-enable audit trigger
  ALTER TABLE complaints ENABLE TRIGGER trg_audit_complaints;

  RAISE NOTICE 'Successfully generated % test complaints.', p_count;
END;
$$;
