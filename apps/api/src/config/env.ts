import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const env = parsed.success
  ? parsed.data
  : {
      PORT: 3000,
      NODE_ENV: 'test' as const,
      SUPABASE_URL: 'https://placeholder.supabase.co',
      SUPABASE_ANON_KEY: 'mock-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      CORS_ORIGIN: 'http://localhost:5173',
      RATE_LIMIT_MAX: 100,
      RATE_LIMIT_WINDOW_MS: 900000,
      LOG_LEVEL: 'info' as const,
    };
