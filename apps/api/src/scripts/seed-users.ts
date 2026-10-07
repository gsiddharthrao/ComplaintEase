import { getAdminClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';

const DEMO_USERS = [
  {
    email: 'sidd@gmail.com',
    password: 'Sidd1234',
    full_name: 'Siddharth (Plant Operations Director)',
    role: 'admin' as const,
    department_id: null,
  },
];

async function seed() {
  logger.info('🌱 Starting user seeding...');
  const supabase = getAdminClient();

  for (const user of DEMO_USERS) {
    try {
      logger.info(`Creating or updating user ${user.email}...`);
      // Check if user already exists
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users.find((u) => u.email === user.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        // Update user password and metadata
        await supabase.auth.admin.updateUserById(userId, {
          password: user.password,
          user_metadata: {
            full_name: user.full_name,
            role: user.role,
            department_id: user.department_id,
          },
        });
        logger.info(`Updated existing user: ${user.email} (${userId})`);
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

