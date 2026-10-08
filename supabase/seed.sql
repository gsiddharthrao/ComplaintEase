-- ============================================================
-- Seed Data & 10,000+ Realistic Complaints Generator
-- ============================================================

-- 1. Fixed Department UUIDs for deterministic testing
INSERT INTO departments (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Plant Mechanical & Heavy Equipment', 'Hydraulics, compressors, stamping presses, and conveyor systems'),
  ('22222222-2222-2222-2222-222222222222', 'Electrical & Power Distribution', '415V/11kV MCC switchgear, transformers, motor drives, and backup gensets'),
  ('33333333-3333-3333-3333-333333333333', 'Industrial Safety & EHS', 'Environmental health, hazmat containment, machine guards, and OSHA protocols'),
  ('44444444-4444-4444-4444-444444444444', 'Utilities, Steam & HVAC', 'Boiler house, 12-bar steam headers, chillers, cooling towers, and air compressors'),
  ('55555555-5555-5555-5555-555555555555', 'Automation, SCADA & Plant IT', 'PLCs, fieldbus telemetry, control room SCADA, sensors, and plant networking'),
  ('66666666-6666-6666-6666-666666666666', 'General / Miscellaneous Operations', 'General plant facilities, unclassified operations, or issues not covered by specific technical departments')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 2. Categories
INSERT INTO categories (id, name, description, department_id) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Hydraulic & Pneumatic Line Failure', 'High-pressure line bursts, cylinder leakage, manifold seal blowouts', '11111111-1111-1111-1111-111111111111'),
  ('a2222222-2222-2222-2222-222222222222', 'Conveyor & Gearbox Acoustic Vibration', 'Bearing degradation, roller seizure, abnormal gearbox harmonics', '11111111-1111-1111-1111-111111111111'),
  ('b1111111-1111-1111-1111-111111111111', '415V Switchgear & Motor Drive Trip', 'MCC feeder trips, VFD overcurrent fault, terminal busbar thermal spike', '22222222-2222-2222-2222-222222222222'),
  ('b2222222-2222-2222-2222-222222222222', 'Emergency Power & UPS Fault', 'Diesel generator failover stall, battery bank cell discharge', '22222222-2222-2222-2222-222222222222'),
  ('c1111111-1111-1111-1111-111111111111', 'Hazardous Chemical Spill & Fume Alert', 'Coolant/acid containment breach, exhaust scrubber failure', '33333333-3333-3333-3333-333333333333'),
  ('c2222222-2222-2222-2222-222222222222', 'E-Stop & Guard Interlock Defect', 'Safety light curtains, perimeter cage door interlocks, trip wires', '33333333-3333-3333-3333-333333333333'),
  ('d1111111-1111-1111-1111-111111111111', 'High-Pressure Steam Flange Leak', '12-bar boiler header leak, valve gland blowout, live steam hazard', '44444444-4444-4444-4444-444444444444'),
  ('d2222222-2222-2222-2222-222222222222', 'Chiller Plant & Cooling Tower Loop', 'Condenser water temperature spike, cooling water flow drop', '44444444-4444-4444-4444-444444444444'),
  ('e1111111-1111-1111-1111-111111111111', 'PLC Bus Timeout & Sensor Fault', 'Profibus/Modbus drops, 4-20mA pressure/temp transmitter drift', '55555555-5555-5555-5555-555555555555'),
  ('f1111111-1111-1111-1111-111111111111', 'General Plant Hazard / Near Miss', 'Loose catwalk guardrail, tripping hazard, overhead crane cable wear', NULL),
  ('f2222222-2222-2222-2222-222222222222', 'Miscellaneous / Other Incident', 'General or unclassified incident not covered by standard equipment categories', NULL)
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
    '500-Ton Hydraulic Press primary cylinder pressure drop',
    '415V MCC switchgear feeder breaker tripping on overcurrent',
    '12-Bar steam header flange gasket failure in boiler house',
    'Raw material conveyor belt drive bearing acoustic vibration spike',
    'PLC Profibus DP communication loss in packaging cell #2',
    'Chemical dosing pump diaphragm failure in effluent plant',
    'Cooling water recirculation pump mechanical seal weeping',
    'Emergency stop trip wire broken along assembly line 3',
    'Compressor room receiver vessel pressure relief valve weeping',
    'Heavy crane hoist motor thermal overload trip during ladle transfer'
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

