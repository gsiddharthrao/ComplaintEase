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
          assignments(id, is_active, assigned_to:profiles(id, full_name))
        `, { count: 'exact' });

      // Apply filters
      if (status) query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (category_id) query = query.eq('category_id', category_id);
      if (department_id) query = query.eq('department_id', department_id);

      // Search using trigram / ilike across title & description
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
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
          assignments(id, is_active, assigned_to:profiles(id, full_name), created_at),
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

      // Record initial history
      await supabase.from('status_history').insert({
        complaint_id: data.id,
        from_status: null,
        to_status: 'submitted',
        changed_by: req.user!.id,
        note: 'Complaint submitted by employee',
      });

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

      // Call database function transition_complaint
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
      const { assigned_to, note } = req.body;
      const supabase = req.supabase!;

      // Check complaint exists and is accessible
      const { data: complaint, error: compErr } = await supabase
        .from('complaints')
        .select('id, department_id, status, version')
        .eq('id', id)
        .single();

      if (compErr || !complaint) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Complaint not found or inaccessible',
            requestId: req.id,
          },
        });
        return;
      }

      // Deactivate prior assignments
      await supabase
        .from('assignments')
        .update({ is_active: false })
        .eq('complaint_id', id)
        .eq('is_active', true);

      // Insert new active assignment
      const { data: newAssignment, error: assignErr } = await supabase
        .from('assignments')
        .insert({
          complaint_id: id,
          assigned_to,
          assigned_by: req.user!.id,
          is_active: true,
          note: note || null,
        })
        .select()
        .single();

      if (assignErr) {
        throw assignErr;
      }

      // If status is submitted or under_review, transition automatically to assigned
      if (complaint.status === 'under_review' || complaint.status === 'submitted') {
        if (complaint.status === 'submitted') {
          // Transition submitted -> under_review -> assigned
          await supabase.rpc('transition_complaint', {
            p_complaint_id: id,
            p_new_status: 'under_review',
            p_note: 'Auto review for assignment',
            p_expected_version: complaint.version,
          });
          complaint.version += 1;
        }

        await supabase.rpc('transition_complaint', {
          p_complaint_id: id,
          p_new_status: 'assigned',
          p_note: note ? `Assigned with note: ${note}` : 'Assigned to specialist',
          p_expected_version: complaint.version,
        });
      }

      res.status(201).json({
        data: newAssignment,
      });
    } catch (err) {
      next(err);
    }
  },
);

