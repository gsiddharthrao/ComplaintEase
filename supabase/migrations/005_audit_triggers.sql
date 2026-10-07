-- ============================================================
-- Migration 005: Tamper-Proof Audit Logging & Auto-Timestamps
-- ============================================================

-- Function to record audit logs automatically on mutations
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_old_data JSONB := NULL;
  v_new_data JSONB := NULL;
  v_row_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_row_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_row_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_row_id := OLD.id;
  END IF;

  INSERT INTO audit_logs (
    actor,
    action,
    table_name,
    row_id,
    old_data,
    new_data,
    created_at
  ) VALUES (
    v_actor,
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_old_data,
    v_new_data,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit triggers to target tables
DROP TRIGGER IF EXISTS trg_audit_complaints ON complaints;
CREATE TRIGGER trg_audit_complaints
  AFTER INSERT OR UPDATE OR DELETE ON complaints
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_assignments ON assignments;
CREATE TRIGGER trg_audit_assignments
  AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_comments ON comments;
CREATE TRIGGER trg_audit_comments
  AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS trg_audit_profiles ON profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Tamper-proofing: Prevent any UPDATE or DELETE on audit_logs
CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log table is append-only. UPDATE and DELETE operations are strictly forbidden.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs;
CREATE TRIGGER trg_protect_audit_logs
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION block_audit_log_modification();

-- Revoke mutation permissions as an extra layer of defense
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM authenticated, anon, public;

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_departments_updated ON departments;
CREATE TRIGGER trg_touch_departments_updated
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_profiles_updated ON profiles;
CREATE TRIGGER trg_touch_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_complaints_updated ON complaints;
CREATE TRIGGER trg_touch_complaints_updated
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_comments_updated ON comments;
CREATE TRIGGER trg_touch_comments_updated
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

