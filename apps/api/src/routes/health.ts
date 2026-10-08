import { Router, Request, Response } from 'express';
import { getAdminClient } from '../utils/supabase.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let dbStatus = 'ok';

  try {
    const supabase = getAdminClient();
    const dbPromise = supabase.from('departments').select('count', { count: 'exact', head: true });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB health timeout')), 3000),
    );

    const { error } = (await Promise.race([dbPromise, timeoutPromise])) as any;
    if (error) {
      dbStatus = 'degraded';
    }
  } catch {
    dbStatus = 'unreachable';
  }

  const latency = Date.now() - startTime;

  res.status(dbStatus === 'ok' ? 200 : 503).json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: latency,
    },
  });
});
