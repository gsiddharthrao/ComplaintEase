import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
  /** Internal notes are only visible to dept_head and admin */
  is_internal: z.boolean().default(false),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = createCommentSchema.partial();
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
