import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createCommentSchema, updateCommentSchema } from '@complaintease/shared';

export const commentsRouter = Router();

/**
 * GET /api/v1/complaints/:id/comments
 * Fetches all comments for a complaint in chronological order.
 * RLS ensures employees never receive rows where is_internal = true.
 */
commentsRouter.get(
  '/complaints/:id/comments',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          complaint_id,
          author_id,
          body,
          is_internal,
          created_at,
          updated_at,
          author:profiles!comments_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('complaint_id', id)
        .order('created_at', { ascending: true });

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
 * POST /api/v1/complaints/:id/comments
 * Adds a new comment to a complaint.
 */
commentsRouter.post(
  '/complaints/:id/comments',
  requireAuth,
  validateBody(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { body, is_internal } = req.body;
      const supabase = req.supabase!;

      // Employees cannot submit internal comments
      const safeIsInternal = req.profile!.role === 'employee' ? false : Boolean(is_internal);

      const { data, error } = await supabase
        .from('comments')
        .insert({
          complaint_id: id,
          author_id: req.user!.id,
          body,
          is_internal: safeIsInternal,
        })
        .select(`
          id,
          complaint_id,
          author_id,
          body,
          is_internal,
          created_at,
          updated_at,
          author:profiles!comments_author_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/comments/:id
 * Updates an existing comment. RLS checks author_id = auth.uid()
 */
commentsRouter.patch(
  '/comments/:id',
  requireAuth,
  validateBody(updateCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { body } = req.body;
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('comments')
        .update({ body })
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
 * DELETE /api/v1/comments/:id
 * Deletes a comment. Author or Admin only.
 */
commentsRouter.delete(
  '/comments/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const supabase = req.supabase!;

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      res.json({ data: { message: 'Comment deleted successfully' } });
    } catch (err) {
      next(err);
    }
  },
);

