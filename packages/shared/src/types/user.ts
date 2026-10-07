import type { UserRole } from './enums.js';

/** Profile row shape (mirrors the profiles table) */
export interface Profile {
  id: string;            // = auth.users.id (UUID)
  full_name: string;
  role: UserRole;
  department_id: string | null;  // null for admin
  avatar_url: string | null;
  created_at: string;    // ISO 8601
  updated_at: string;
}

/** Minimal user info returned by auth/me endpoint */
export interface AuthMe {
  id: string;
  email: string;
  profile: Profile;
}
