/** Department row shape (mirrors the departments table) */
export interface Department {
  id: string;
  name: string;
  description: string | null;
  head_id: string | null;  // FK to profiles.id
  created_at: string;
  updated_at: string;
}
