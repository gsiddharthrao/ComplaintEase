import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Creates a per-request Supabase client configured with the caller's JWT.
 * When this client queries the database, Postgres receives the user's JWT,
 * activating Row Level Security (RLS) and auth.uid() automatically.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Service role client bypasses RLS.
 * Restricted strictly to system maintenance tasks, seeding, and user provisioning.
 * MUST NEVER be attached to ordinary user requests.
 */
let serviceClientInstance: SupabaseClient | null = null;
export function getAdminClient(): SupabaseClient {
  if (!serviceClientInstance) {
    serviceClientInstance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return serviceClientInstance;
}
