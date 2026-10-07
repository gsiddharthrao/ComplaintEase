import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

export const adminRouter = Router();

// Guard only /admin endpoints
adminRouter.use('/admin', requireAuth, requireRole(['admin']));

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
  role: z.enum(['employee', 'dept_head', 'admin']),
  department_id: z.string().uuid().optional().nullable(),
});

// ---- Departments ----
adminRouter.get('/admin/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('departments')
      .select('*, head:profiles!fk_departments_head(id, full_name)')
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.post('/admin/departments', validateBody(departmentSchema), async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.patch('/admin/departments/:id', validateBody(departmentSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.delete('/admin/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
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
adminRouter.get('/admin/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('categories')
      .select('*, department:departments(id, name)')
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.post('/admin/categories', validateBody(categorySchema), async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.patch('/admin/categories/:id', validateBody(categorySchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.delete('/admin/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
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
adminRouter.get('/admin/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await req.supabase!
      .from('profiles')
      .select('*, department:departments(id, name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

adminRouter.patch('/admin/users/:id/role', validateBody(updateUserRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
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
adminRouter.get('/admin/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
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
        created_at,
        actor_profile:profiles!audit_logs_actor_fkey(full_name, role)
      `, { count: 'exact' });

    if (table_name) {
      query = query.eq('table_name', table_name);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      total_count: count ?? (data?.length || 0),
    });
  } catch (err) { next(err); }
});
