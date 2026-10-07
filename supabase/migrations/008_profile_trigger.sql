-- ============================================================
-- Migration 008: Auto-Profile Creation on Auth Sign-Up
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role := 'employee';
  v_dept UUID := NULL;
  v_meta_role TEXT;
  v_meta_dept TEXT;
BEGIN
  v_meta_role := NEW.raw_user_meta_data->>'role';
  v_meta_dept := NEW.raw_user_meta_data->>'department_id';

  IF v_meta_role IN ('employee', 'dept_head', 'admin') THEN
    v_role := v_meta_role::user_role;
  END IF;

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
    v_role,
    v_dept,
    NEW.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
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

