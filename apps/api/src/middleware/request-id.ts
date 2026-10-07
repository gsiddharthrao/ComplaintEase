import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = reqId;
  res.setHeader('x-request-id', reqId);
  next();
}
