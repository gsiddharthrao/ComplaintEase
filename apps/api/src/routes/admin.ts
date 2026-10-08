import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

export const adminRouter = Router();

const requireAdmin = [requireAuth, requireRole(['admin'])];

const departmentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  head_id: z.string().uuid().optional().nullable(),
});

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['employee', 'admin']),
  department_id: z.string().uuid().optional().nullable(),
});

// ---- Departments ----
// Read departments is accessible to all authenticated users (employees need it to submit complaints)
adminRouter.get(['/admin/departments', '/departments'], requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('departments')
      .select('*, head:profiles!fk_departments_head(id, full_name)')
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.post('/admin/departments', requireAdmin, validateBody(departmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('departments')
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

adminRouter.patch('/admin/departments/:id', requireAdmin, validateBody(departmentSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('departments')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.delete('/admin/departments/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await req.supabase!
      .from('departments')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ data: { message: 'Department deleted successfully' } });
  } catch (err) { next(err); }
});

// ---- Categories ----
// Read categories is accessible to all authenticated users (employees need it to submit complaints)
adminRouter.get(['/admin/categories', '/categories'], requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('categories')
      .select('*, department:departments(id, name)')
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.post('/admin/categories', requireAdmin, validateBody(categorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('categories')
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

adminRouter.patch('/admin/categories/:id', requireAdmin, validateBody(categorySchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('categories')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.delete('/admin/categories/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await req.supabase!
      .from('categories')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ data: { message: 'Category deleted successfully' } });
  } catch (err) { next(err); }
});

// ---- Users Management ----
adminRouter.get('/admin/users', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('profiles')
      .select('*, department:departments!profiles_department_id_fkey(id, name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.patch('/admin/users/:id/role', requireAdmin, validateBody(updateUserRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prevent admin from demoting their own account
    if (req.params.id === req.user!.id && req.body.role !== 'admin') {
      res.status(400).json({
        error: {
          code: 'CANNOT_DEMOTE_SELF',
          message: 'Administrators cannot demote their own account.',
          requestId: req.id,
        },
      });
      return;
    }

    const { data, error } = await req.supabase!
      .from('profiles')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ---- Audit Logs (Read-Only) ----
adminRouter.get('/admin/audit-logs', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table_name, limit = 50, offset = 0 } = req.query;
    let query = req.supabase!
      .from('audit_logs')
      .select(`
        id,
        actor,
        action,
        table_name,
        row_id,
        old_data,
        new_data,
        created_at
      `, { count: 'exact' });

    if (table_name) {
      query = query.eq('table_name', table_name);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const actorIds = [...new Set((data || []).map((d) => d.actor).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await req.supabase!
        .from('profiles')
        .select('id, full_name, role')
        .in('id', actorIds);
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      }
    }

    const enrichedData = (data || []).map((d) => ({
      ...d,
      actor_profile: d.actor ? profilesMap[d.actor] || null : null,
    }));

    res.json({
      data: enrichedData,
      total_count: count ?? (data?.length || 0),
    });
  } catch (err) { next(err); }
});
