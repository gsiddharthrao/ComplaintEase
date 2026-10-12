import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createComplaintSchema,
  listComplaintsSchema,
  transitionSchema,
  assignSchema,
} from '@complaintease/shared';

export const complaintsRouter = Router();

/**
 * GET /api/v1/complaints
 * Lists complaints with keyset pagination, filters, and full relation joins.
 * Avoids N+1 queries by embedding relations directly in a single PostgREST query.
 */
complaintsRouter.get(
  '/complaints',
  requireAuth,
  validateQuery(listComplaintsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, priority, category_id, department_id, search, cursor, limit } = req.query as any;
      const supabase = req.supabase!;

      // Single joined query: category, department, creator, active assignment
      let query = supabase
        .from('complaints')
        .select(`
          id,
          title,
          description,
          category_id,
          department_id,
          created_by,
          status,
          priority,
          created_at,
          updated_at,
          resolved_at,
          version,
          location_lat,
          location_lng,
          location_address,
          image_url,
          category:categories(id, name),
          department:departments(id, name),
          creator:profiles!complaints_created_by_fkey(id, full_name, avatar_url),
          assignments(id, is_active, assigned_to:profiles!assignments_assigned_to_fkey(id, full_name))
        `, { count: 'exact' });

      // Apply filters
      if (status) query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (category_id) query = query.eq('category_id', category_id);
      if (department_id) query = query.eq('department_id', department_id);

      // Search using trigram / ilike across title & description
      if (search) {
        const sanitizedSearch = String(search).replace(/[,()]/g, ' ').trim();
        if (sanitizedSearch) {
          query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
        }
      }

      // Keyset pagination (cursor: "created_at__id")
      if (cursor) {
        const [cursorTime, cursorId] = cursor.split('__');
        if (cursorTime && cursorId) {
          query = query.or(`created_at.lt.${cursorTime},and(created_at.eq.${cursorTime},id.lt.${cursorId})`);
        }
      }

      // Order by created_at DESC, id DESC to ensure deterministic pagination
      query = query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      // Format response, picking active assignment
      const formatted = (data || []).map((row: any) => {
        const activeAssignment = Array.isArray(row.assignments)
          ? row.assignments.find((a: any) => a.is_active)
          : null;

        return {
          id: row.id,
          title: row.title,
          description: row.description,
          category_id: row.category_id,
          department_id: row.department_id,
          created_by: row.created_by,
          status: row.status,
          priority: row.priority,
          created_at: row.created_at,
          updated_at: row.updated_at,
          resolved_at: row.resolved_at,
          version: row.version,
          location_lat: row.location_lat ?? null,
          location_lng: row.location_lng ?? null,
          location_address: row.location_address ?? null,
          image_url: row.image_url ?? null,
          category: row.category || { id: row.category_id, name: 'Unknown' },
          department: row.department || { id: row.department_id, name: 'Unknown' },
          creator: row.creator || { id: row.created_by, full_name: 'Unknown', avatar_url: null },
          assigned_to: activeAssignment?.assigned_to || null,
        };
      });

      // Next cursor computation
      let nextCursor: string | null = null;
      if (formatted.length === limit && formatted.length > 0) {
        const last = formatted[formatted.length - 1];
        nextCursor = `${last.created_at}__${last.id}`;
      }

      res.json({
        data: formatted,
        next_cursor: nextCursor,
        total_count: count ?? formatted.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/complaints/:id
 * Fetches single complaint with complete status history and active assignments
 */
complaintsRouter.get(
  '/complaints/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('complaints')
        .select(`
          id,
          title,
          description,
          category_id,
          department_id,
          created_by,
          status,
          priority,
          created_at,
          updated_at,
          resolved_at,
          version,
          location_lat,
          location_lng,
          location_address,
          image_url,
          category:categories(id, name),
          department:departments(id, name),
          creator:profiles!complaints_created_by_fkey(id, full_name, avatar_url),
          assignments(id, is_active, assigned_to:profiles!assignments_assigned_to_fkey(id, full_name), created_at),
          status_history(
            id,
            from_status,
            to_status,
            note,
            created_at,
            changer:profiles!status_history_changed_by_fkey(full_name)
          )
        `)
        .eq('id', id)
        .order('created_at', { foreignTable: 'status_history', ascending: true })
        .single();

      if (error || !data) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Complaint not found or access denied.',
            requestId: req.id,
          },
        });
        return;
      }

      const activeAssignment = Array.isArray((data as any).assignments)
        ? (data as any).assignments.find((a: any) => a.is_active)
        : null;

      res.json({
        data: {
          ...data,
          assigned_to: activeAssignment?.assigned_to || null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/complaints
 * Creates a new complaint. RLS automatically verifies created_by = auth.uid()
 */
complaintsRouter.post(
  '/complaints',
  requireAuth,
  validateBody(createComplaintSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        title,
        description,
        category_id,
        department_id,
        priority,
        location_lat,
        location_lng,
        location_address,
        image_url,
      } = req.body;
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('complaints')
        .insert({
          title,
          description,
          category_id,
          department_id,
          priority,
          location_lat: location_lat ?? null,
          location_lng: location_lng ?? null,
          location_address: location_address ?? null,
          image_url: image_url ?? null,
          created_by: req.user!.id,
          status: 'submitted',
          version: 1,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Initial status_history is atomically recorded via database trigger trg_complaint_initial_history
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/complaints/:id/transition
 * Executes state machine transition via the secure stored function transition_complaint()
 */
complaintsRouter.post(
  '/complaints/:id/transition',
  requireAuth,
  validateBody(transitionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { new_status, note, expected_version } = req.body;
      const supabase = req.supabase!;

      // Call database function transition_complaint passing client expected_version directly for OCC
      const { data, error } = await supabase.rpc('transition_complaint', {
        p_complaint_id: id,
        p_new_status: new_status,
        p_note: note || null,
        p_expected_version: expected_version,
      });

      if (error) {
        throw error;
      }

      res.json({
        data: {
          message: 'Status transition completed successfully',
          result: data,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/complaints/:id/assign
 * Assigns a complaint to a staff member. Restricted to admin.
 */
complaintsRouter.post(
  '/complaints/:id/assign',
  requireAuth,
  requireRole(['admin']),
  validateBody(assignSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { assigned_to, note, expected_version } = req.body;
      const supabase = req.supabase!;

      const { data, error } = await supabase.rpc('assign_specialist', {
        p_complaint_id: id,
        p_assigned_to: assigned_to,
        p_note: note || null,
        p_expected_version: expected_version,
      });

      if (error) {
        throw error;
      }

      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

