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

  // Map known Postgres error codes to appropriate HTTP statuses
  if (err.message && err.message.includes('P0001')) {
    code = 'INVALID_TRANSITION';
    res.status(400);
  } else if (err.message && err.message.includes('P0002')) {
    code = 'NOT_FOUND';
    res.status(404);
  } else if (err.message && err.message.includes('P0003')) {
    code = 'VERSION_CONFLICT';
    res.status(409); // Conflict for optimistic locking failure
  } else if (err.message && err.message.includes('P0004')) {
    code = 'TRANSITION_FORBIDDEN';
    res.status(403);
  } else if (err.message && err.message.includes('P0005')) {
    code = 'DIRECT_STATUS_UPDATE_FORBIDDEN';
    res.status(403);
  } else if (err.message && err.message.includes('42501')) {
    code = 'FORBIDDEN';
    res.status(403);
  } else if (err.message && err.message.includes('55000')) {
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

