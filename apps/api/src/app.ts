import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { v1Router } from './routes/index.js';

export const app = express();

// Trust reverse proxy (e.g. Nginx, Render, Vercel)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server) or matching origin
      if (!origin || env.CORS_ORIGIN.split(',').map((o) => o.trim()).includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
  }),
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracing ID
app.use(requestIdMiddleware);

// HTTP Access Logging
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      genReqId: (req) => req.id || 'unknown',
    }),
  );
}

// Strict limiter for authentication and mutation routes
const authMutationLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.min(env.RATE_LIMIT_MAX, 50),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many auth or mutation requests from this IP. Please wait before retrying.',
    },
  },
});

// General limiter for read queries
const generalReadLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.max(env.RATE_LIMIT_MAX, 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please wait before retrying.',
    },
  },
});

app.use('/api/v1/auth', authMutationLimiter);
app.use('/api/', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return authMutationLimiter(req, res, next);
  }
  return generalReadLimiter(req, res, next);
});

// Mount versioned API routes
app.use('/api/v1', v1Router);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      requestId: req.id,
    },
  });
});

// Centralized error handling
app.use(errorHandler);

