import { Request, Response, NextFunction } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@complaintease/shared';
import { createUserClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      supabase?: SupabaseClient;
      user?: User;
      profile?: Profile;
      token?: string;
    }
  }
}

/**
 * Middleware: Verifies the caller's Supabase JWT Bearer token,
 * instantiates a user-scoped Supabase client that obeys RLS,
 * and fetches the user's profile.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization header. Expected Bearer token.',
          requestId: req.id,
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Bearer token string is empty.',
          requestId: req.id,
        },
      });
      return;
    }

    // Create user-scoped client
    const supabase = createUserClient(token);

    // Verify token by querying Supabase Auth
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      logger.warn({ err: userError, reqId: req.id }, 'Invalid or expired JWT token');
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Session is invalid or expired. Please sign in again.',
          requestId: req.id,
        },
      });
      return;
    }

    // Fetch caller's application profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !profileData) {
      logger.warn({ err: profileError, userId: userData.user.id }, 'Profile not found for authenticated user');
      res.status(403).json({
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile does not exist in the database.',
          requestId: req.id,
        },
      });
      return;
    }

    req.token = token;
    req.supabase = supabase;
    req.user = userData.user;
    req.profile = profileData as Profile;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-guard middleware: Ensures caller has one of the allowed roles.
 * Note: Database RLS provides the true security boundary; this provides early 403 HTTP responses.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.profile) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required prior to role verification.',
          requestId: req.id,
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.profile.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.profile.role}`,
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

