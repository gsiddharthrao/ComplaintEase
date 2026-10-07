/** Notification row shape (mirrors the notifications table) */
export interface Notification {
  id: string;
  user_id: string;
  complaint_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  | 'status_changed'
  | 'comment_added'
  | 'assigned'
  | 'complaint_resolved'
  | 'complaint_reopened';
