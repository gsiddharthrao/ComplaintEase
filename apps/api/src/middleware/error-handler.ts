import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.id;
  const statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal error occurred';

  // Extract structured codes from err.code, SQLSTATE, or message
  const errCode = ((err as any).code || (err as any).sqlState || (err as any).status || '').toString();
  const errMsg = (err.message || '').toString();
  const match = (target: string) => errCode === target || errMsg.includes(target);

  // Map known Postgres error codes to appropriate HTTP statuses
  if (match('P0001')) {
    code = 'INVALID_TRANSITION';
    res.status(400);
  } else if (match('P0002') || match('PGRST116')) {
    code = 'NOT_FOUND';
    res.status(404);
    message = 'Resource not found or inaccessible';
  } else if (match('P0003')) {
    code = 'VERSION_CONFLICT';
    res.status(409); // Conflict for optimistic locking failure
    message = 'Conflict: this complaint has been updated by another user. Please refresh.';
  } else if (match('P0004')) {
    code = 'TRANSITION_FORBIDDEN';
    res.status(403);
  } else if (match('42501')) {
    code = 'FORBIDDEN';
    res.status(403);
  } else if (match('P0005')) {
    code = 'DIRECT_STATUS_UPDATE_FORBIDDEN';
    res.status(403);
  } else if (match('P0006') || match('55000')) {
    code = 'AUDIT_LOG_IMMUTABLE';
    res.status(403);
  } else {
    res.status(statusCode);
  }

  // Prevent leaking raw internal database / driver errors in production
  if (res.statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'An unexpected internal error occurred';
  }

  logger.error(
    {
      err,
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
    },
    `Request error: ${message}`,
  );

  res.json({
    error: {
      code,
      message,
      details: err.details || null,
      requestId,
    },
  });
}

