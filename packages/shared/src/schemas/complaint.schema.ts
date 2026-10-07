import { z } from 'zod';

/** Create a new complaint */
export const createComplaintSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  category_id: z.string().uuid('Must be a valid category ID'),
  department_id: z.string().uuid('Must be a valid department ID'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  location_address: z.string().max(500).nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

/** Filters for listing complaints */
export const listComplaintsSchema = z.object({
  status: z.enum(['submitted','under_review','assigned','in_progress','resolved','closed','rejected','reopened']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  category_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  /** Keyset pagination cursor: format is "<created_at>__<id>" */
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListComplaintsInput = z.infer<typeof listComplaintsSchema>;
