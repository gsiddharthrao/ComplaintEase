import { getAdminClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const adminEmail = process.env.ADMIN_EMAIL || process.argv[2];
const adminPassword = process.env.ADMIN_PASSWORD || process.argv[3];
const adminName = process.env.ADMIN_NAME || process.argv[4] || 'Plant System Administrator';

if (!adminEmail || !adminPassword) {
  logger.error(
    'Missing ADMIN_EMAIL or ADMIN_PASSWORD. Provide them in .env or pass as arguments: pnpm seed <email> <password> [name]',
  );
  process.exit(1);
}

// Production safeguard
const targetUrl = process.env.SUPABASE_URL || '';
const isProdTarget = targetUrl.includes('kdsjbdxtakgslextabpi') || process.env.NODE_ENV === 'production';
if (isProdTarget && process.env.ALLOW_PROD_SEED !== 'true') {
  logger.error(
    '🛡️ [PRODUCTION SAFEGUARD] Refusing to execute user seed script against production Supabase without ALLOW_PROD_SEED=true',
  );
  process.exit(1);
}

const PROVISION_USERS = [
  {
    email: adminEmail,
    password: adminPassword,
    full_name: adminName,
    role: 'admin' as const,
    department_id: null,
  },
];

async function findUserByEmail(supabase: any, email: string) {
  let page = 1;
  const perPage = 50;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      logger.error({ err: error }, 'Error listing users during seed check');
      break;
    }
    if (!data?.users || data.users.length === 0) break;
    const match = data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}

async function seed() {
  logger.info('🌱 Starting user seeding...');
  const supabase = getAdminClient();

  for (const user of PROVISION_USERS) {
    try {
      logger.info(`Checking user ${user.email}...`);
      const existingUser = await findUserByEmail(supabase, user.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        const resetPassword = process.env.RESET_EXISTING_PASSWORD === 'true';

        const updatePayload: Record<string, any> = {
          user_metadata: {
            full_name: user.full_name,
            role: user.role,
            department_id: user.department_id,
          },
        };

        if (resetPassword) {
          updatePayload.password = user.password;
          logger.info(`Resetting password for existing user: ${user.email} (${userId})`);
        } else {
          logger.info(
            `Existing user found: ${user.email} (${userId}). Preserving existing password (set RESET_EXISTING_PASSWORD=true to overwrite).`,
          );
        }

        const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, updatePayload);
        if (updateErr) {
          logger.error({ err: updateErr }, `Failed to update existing user ${user.email}`);
          continue;
        }
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
            role: user.role,
            department_id: user.department_id,
          },
        });

        if (error) {
          logger.error({ err: error }, `Failed to create user ${user.email}`);
          continue;
        }

        userId = data.user.id;
        logger.info(`Created user: ${user.email} (${userId})`);
      }

      // Upsert profile table row directly
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: user.full_name,
        role: user.role,
        department_id: user.department_id,
        updated_at: new Date().toISOString(),
      });

      if (profileErr) {
        logger.error({ err: profileErr }, `Failed to upsert profile for ${user.email}`);
      } else {
        logger.info(`Profile upserted for ${user.email}`);
      }
    } catch (err) {
      logger.error({ err }, `Error provisioning ${user.email}`);
    }
  }

  logger.info('✅ User seeding completed successfully.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Seed script failed');
    process.exit(1);
  });

