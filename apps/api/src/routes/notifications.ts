import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

/**
 * GET /api/v1/notifications
 * Lists current user notifications. RLS enforces user_id = auth.uid()
 */
notificationsRouter.get(
  '/notifications',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      res.json({ data: data || [] });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a notification as read
 */
notificationsRouter.patch(
  '/notifications/:id/read',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/notifications/read-all
 * Marks all notifications for current user as read
 */
notificationsRouter.post(
  '/notifications/read-all',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const supabase = req.supabase!;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) {
        throw error;
      }

      res.json({ data: { message: 'All notifications marked as read' } });
    } catch (err) {
      next(err);
    }
  },
);
