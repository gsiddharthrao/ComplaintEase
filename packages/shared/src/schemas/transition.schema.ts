import { z } from 'zod';

/**
 * Schema for the transition endpoint.
 * `expected_version` is used for optimistic locking:
 * the DB function will reject the transition if the complaint
 * has been modified since the client last fetched it.
 */
export const transitionSchema = z.object({
  new_status: z.enum([
    'submitted','under_review','assigned','in_progress',
    'resolved','closed','rejected','reopened'
  ]),
  note: z.string().max(1000).nullable().optional(),
  expected_version: z.number().int().min(1),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

/** Schema for assigning a complaint to a user */
export const assignSchema = z.object({
  assigned_to: z.string().uuid('Must be a valid user ID'),
  note: z.string().max(500).optional(),
});

export type AssignInput = z.infer<typeof assignSchema>;
