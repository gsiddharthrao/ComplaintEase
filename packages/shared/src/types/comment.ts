/** Comment row shape (mirrors the comments table) */
export interface Comment {
  id: string;
  complaint_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;  // internal notes visible only to dept_head + admin
  created_at: string;
  updated_at: string;
  author: { id: string; full_name: string; avatar_url: string | null };
}
