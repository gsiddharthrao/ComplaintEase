/** Category row shape (mirrors the categories table) */
export interface Category {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null; // null = applies to all departments
  created_at: string;
}
