-- ============================================================
-- Migration 007: Realtime, Storage, and Automated Notifications
-- ============================================================

-- Realtime publication subscription
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comments;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Storage bucket initialization for complaint attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies
DO $$ BEGIN
  CREATE POLICY "storage_upload_policy"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "storage_read_policy"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Notification automation triggers
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (
      user_id,
      complaint_id,
      type,
      title,
      body,
      is_read,
      created_at
    ) VALUES (
      NEW.created_by,
      NEW.id,
      'status_changed',
      'Complaint Status Updated',
      format('Complaint "%s" moved from %s to %s', NEW.title, OLD.status, NEW.status),
      false,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_status_change ON complaints;
CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE OF status ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_change();

-- Notification on assignment
CREATE OR REPLACE FUNCTION notify_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.is_active = true THEN
    SELECT title INTO v_title FROM complaints WHERE id = NEW.complaint_id;
    INSERT INTO notifications (
      user_id,
      complaint_id,
      type,
      title,
      body,
      is_read,
      created_at
    ) VALUES (
      NEW.assigned_to,
      NEW.complaint_id,
      'assigned',
      'New Complaint Assigned',
      format('You were assigned to complaint "%s"', coalesce(v_title, 'Untitled')),
      false,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_assignment ON assignments;
CREATE TRIGGER trg_notify_assignment
  AFTER INSERT OR UPDATE ON assignments
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION notify_assignment();

-- Notification on new comment
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_complaint complaints%ROWTYPE;
  v_author_name TEXT;
BEGIN
  SELECT * INTO v_complaint FROM complaints WHERE id = NEW.complaint_id;
  SELECT full_name INTO v_author_name FROM profiles WHERE id = NEW.author_id;

  -- Only notify complaint owner if comment is not internal and author is not creator
  IF NEW.is_internal = false AND v_complaint.created_by != NEW.author_id THEN
    INSERT INTO notifications (
      user_id,
      complaint_id,
      type,
      title,
      body,
      is_read,
      created_at
    ) VALUES (
      v_complaint.created_by,
      v_complaint.id,
      'comment_added',
      'New Comment on Your Complaint',
      format('%s commented on "%s"', coalesce(v_author_name, 'Staff'), v_complaint.title),
      false,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment ON comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

