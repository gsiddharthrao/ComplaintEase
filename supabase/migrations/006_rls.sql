-- ============================================================
-- Migration 006: Row Level Security (RLS) Policies
-- ============================================================

-- Aliases to support both naming styles
CREATE OR REPLACE FUNCTION current_role() RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT current_user_role(); $$;
CREATE OR REPLACE FUNCTION current_dept() RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT current_user_dept(); $$;
GRANT EXECUTE ON FUNCTION current_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_dept() TO authenticated, anon;

-- 1. profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- 2. departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_select_authenticated"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "departments_admin_all"
  ON departments FOR ALL
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- 3. categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_authenticated"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "categories_admin_all"
  ON categories FOR ALL
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- 4. complaints
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_select_employee"
  ON complaints FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND created_by = auth.uid()
  );

CREATE POLICY "complaints_select_admin"
  ON complaints FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

CREATE POLICY "complaints_insert_authenticated"
  ON complaints FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "complaints_update_admin"
  ON complaints FOR UPDATE
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- 5. assignments
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_select_employee"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "assignments_select_admin"
  ON assignments FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

CREATE POLICY "assignments_insert_admin"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'admin'
    AND assigned_by = auth.uid()
  );

CREATE POLICY "assignments_update_admin"
  ON assignments FOR UPDATE
  TO authenticated
  USING (current_user_role() = 'admin');

-- 6. comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_employee"
  ON comments FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "comments_select_admin"
  ON comments FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

CREATE POLICY "comments_insert_employee"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'employee'
    AND author_id = auth.uid()
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "comments_insert_admin"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'admin'
    AND author_id = auth.uid()
  );

CREATE POLICY "comments_update_author"
  ON comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "comments_delete_author_or_admin"
  ON comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR current_user_role() = 'admin');

-- 7. attachments
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select_employee"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "attachments_select_admin"
  ON attachments FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

CREATE POLICY "attachments_insert_authenticated"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      (current_user_role() = 'employee' AND EXISTS (SELECT 1 FROM complaints WHERE id = complaint_id AND created_by = auth.uid()))
      OR
      (current_user_role() = 'admin')
    )
  );

-- 8. status_history
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_history_select_employee"
  ON status_history FOR SELECT
  TO authenticated
  USING (
    current_user_role() = 'employee'
    AND EXISTS (
      SELECT 1 FROM complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "status_history_select_admin"
  ON status_history FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

-- 9. audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (current_user_role() = 'admin');

-- 10. notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 11. allowed_transitions
ALTER TABLE allowed_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_transitions_select_authenticated"
  ON allowed_transitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allowed_transitions_admin_all"
  ON allowed_transitions FOR ALL
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

