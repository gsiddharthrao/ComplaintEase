import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema } from '@complaintease/shared';
import { getAdminClient } from '../utils/supabase.js';

export const authRouter = Router();

/**
 * GET /api/v1/auth/me
 * Returns current authenticated user and profile
 */
authRouter.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    data: {
      id: req.user!.id,
      email: req.user!.email,
      profile: req.profile!,
    },
  });
});

/**
 * POST /api/v1/auth/register
 * Self-registration for demonstration / onboarding
 */
authRouter.post(
  '/auth/register',
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, full_name, role, department_id } = req.body;
      const adminSupabase = getAdminClient();

      const { data, error } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
          department_id: department_id || null,
        },
      });

      if (error) {
        res.status(400).json({
          error: {
            code: 'REGISTRATION_FAILED',
            message: error.message,
            requestId: req.id,
          },
        });
        return;
      }

      res.status(201).json({
        data: {
          id: data.user.id,
          email: data.user.email,
          message: 'User registered successfully. You may now sign in.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
