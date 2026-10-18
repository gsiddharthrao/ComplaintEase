import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').default('https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required').default('placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required').default('placeholder-service-role-key'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export const PRODUCTION_PROJECT_REF = 'kdsjbdxtakgslextabpi';

export function validateEnv(rawEnv: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(rawEnv);
  const nodeEnv = rawEnv.NODE_ENV || parsed.data?.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    if (!parsed.success) {
      throw new Error(`Production environment validation failed: ${parsed.error.message}`);
    }
    const isPlaceholder = (val: string | undefined) =>
      !val || val.toLowerCase().includes('placeholder') || val.toLowerCase().includes('mock-');
    if (
      isPlaceholder(parsed.data.SUPABASE_URL) ||
      isPlaceholder(parsed.data.SUPABASE_ANON_KEY) ||
      isPlaceholder(parsed.data.SUPABASE_SERVICE_ROLE_KEY)
    ) {
      throw new Error('Production environment cannot start with placeholder Supabase credentials.');
    }
  }

  // Safeguard against accidental production database access in non-production environments
  const supabaseUrl = rawEnv.SUPABASE_URL || (parsed.success ? parsed.data.SUPABASE_URL : '');
  if (nodeEnv !== 'production' && supabaseUrl.includes(PRODUCTION_PROJECT_REF)) {
    if (rawEnv.ALLOW_PROD_DB_IN_DEV !== 'true') {
      throw new Error(
        `🛡️ [PRODUCTION SAFEGUARD] Refusing to connect non-production environment (${nodeEnv}) to production Supabase project (${PRODUCTION_PROJECT_REF}) without explicit opt-in. Set ALLOW_PROD_DB_IN_DEV=true only if intentional.`,
      );
    }
    console.warn(
      `🛡️ [PRODUCTION SAFEGUARD] Explicit opt-in ALLOW_PROD_DB_IN_DEV=true detected. Connecting non-production environment (${nodeEnv}) to production Supabase project (${PRODUCTION_PROJECT_REF}).`,
    );
  }

  return parsed;
}

const parsed = validateEnv(process.env);

if (!parsed.success) {
  console.warn('⚠️ Missing or invalid environment variables. Using development fallbacks.');
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
