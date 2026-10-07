import type { ComplaintStatus, ComplaintPriority } from './enums.js';

/** Complaint row shape (mirrors the complaints table) */
export interface Complaint {
  id: string;
  title: string;
  description: string;
  category_id: string;
  department_id: string;
  created_by: string;     // FK to profiles.id
  status: ComplaintStatus;
  priority: ComplaintPriority;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  version: number;        // for optimistic locking
}

/** Enriched complaint with joined relations (used in list/detail responses) */
export interface ComplaintWithRelations extends Complaint {
  category: { id: string; name: string };
  department: { id: string; name: string };
  creator: { id: string; full_name: string; avatar_url: string | null };
  assigned_to: { id: string; full_name: string } | null;
  comment_count: number;
  attachment_count: number;
}

/** Status history entry (mirrors status_history table) */
export interface StatusHistory {
  id: string;
  complaint_id: string;
  from_status: ComplaintStatus | null;
  to_status: ComplaintStatus;
  changed_by: string;
  note: string | null;
  created_at: string;
  changer: { full_name: string };
}

/** Paginated list response for complaints */
export interface ComplaintListResponse {
  data: ComplaintWithRelations[];
  /** Cursor for the next page (last row's created_at + id). null when no more pages. */
  next_cursor: string | null;
  total_count: number;
}
