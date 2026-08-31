import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

interface UserJson {
  userId: number;
  address: string;
  referrerId?: number | null;
  registrationTx: string;
  activeLevels?: {
    A?: number[];
    B?: number[];
  };
}

function loadUsers(): UserJson[] {
  const usersDir = path.resolve(__dirname, '../../../users');
  if (!fs.existsSync(usersDir)) {
    throw new Error(`Users directory not found: ${usersDir}`);
  }

  const users = fs
    .readdirSync(usersDir)
    .filter((file) => /^user\d+\.json$/i.test(file))
    .map((file) => {
      const raw = fs.readFileSync(path.join(usersDir, file), 'utf8');
      return JSON.parse(raw) as UserJson;
    })
    .filter((user) => user.userId && user.address && user.registrationTx)
    .sort((a, b) => a.userId - b.userId);

  if (users.length === 0) {
    throw new Error('No user JSON files found in users/');
  }

  return users;
}

function getActiveLevels(user: UserJson): { orbit: 'ORBIT_A' | 'ORBIT_B'; level: number }[] {
  const levels = new Map<string, { orbit: 'ORBIT_A' | 'ORBIT_B'; level: number }>();

  const add = (orbit: 'ORBIT_A' | 'ORBIT_B', levelNumbers: number[] | undefined, fallback: number[]) => {
    const nums = levelNumbers && levelNumbers.length > 0 ? levelNumbers : fallback;
    for (const level of nums) {
      levels.set(`${orbit}:${level}`, { orbit, level });
    }
  };

  if (user.userId === 1) {
    for (let level = 1; level <= 10; level++) {
      add('ORBIT_A', [level], [level]);
      add('ORBIT_B', [level], [level]);
    }
    return Array.from(levels.values());
  }

  add('ORBIT_A', user.activeLevels?.A, [1]);
  add('ORBIT_B', user.activeLevels?.B, [1]);

  return Array.from(levels.values());
}

async function seedFromUsers() {
  const users = loadUsers();
  console.log(`[INFO] Loaded ${users.length} users from users/*.json`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await dataSource.initialize();
  console.log('[INFO] Database connected');

  try {
    await dataSource.query(`
      TRUNCATE TABLE announcements, missed_payments, events, level_cycles, payments, user_levels, users
      RESTART IDENTITY CASCADE
    `);

    const idByUserId = new Map<number, number>();

    for (const user of users) {
      const registeredAt = new Date(Date.now() - (users.length - user.userId + 1) * 24 * 60 * 60 * 1000);
      const referrerInternalId =
        user.userId === 1 || !user.referrerId ? null : idByUserId.get(user.referrerId) ?? user.referrerId;

      const inserted = await dataSource.query(
        `
        INSERT INTO users (user_id, wallet_address, referrer_id, registered_at, registration_tx_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [
          user.userId,
          user.address.toLowerCase(),
          referrerInternalId,
          registeredAt,
          user.registrationTx,
        ],
      );

      idByUserId.set(user.userId, inserted[0].id);
    }

    console.log(`[SUCCESS] Inserted ${users.length} users with real wallet addresses`);

    let levelCount = 0;
    for (const user of users) {
      const internalId = idByUserId.get(user.userId)!;
      const registeredAt = new Date(Date.now() - (users.length - user.userId + 1) * 24 * 60 * 60 * 1000);

      for (const { orbit, level } of getActiveLevels(user)) {
        await dataSource.query(
          `
          INSERT INTO user_levels (
            user_id, orbit, level_number, is_active, activated_at, activation_tx_hash, recycle_count
          ) VALUES ($1, $2, $3, true, $4, $5, 0)
          ON CONFLICT (user_id, orbit, level_number) DO NOTHING
          `,
          [internalId, orbit, level, registeredAt, user.registrationTx],
        );
        levelCount++;
      }
    }

    console.log(`[SUCCESS] Inserted ${levelCount} user level records`);

    let eventCount = 0;
    for (const user of users) {
      const internalId = idByUserId.get(user.userId)!;
      const referrerInternalId = user.referrerId ? idByUserId.get(user.referrerId) ?? null : null;
      const registeredAt = new Date(Date.now() - (users.length - user.userId + 1) * 24 * 60 * 60 * 1000);

      await dataSource.query(
        `
        INSERT INTO events (
          event_name, contract, user_id, referrer_id, level_number, event_data,
          transaction_hash, block_number, block_timestamp, log_index
        ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, 0)
        ON CONFLICT (transaction_hash, log_index) DO NOTHING
        `,
        [
          'UserRegistered',
          'OrbitA',
          internalId,
          referrerInternalId,
          JSON.stringify({ userID: user.userId, cctAmount: '1000000000000000000' }),
          user.registrationTx,
          100000 + user.userId,
          registeredAt,
        ],
      );
      eventCount++;

      if (user.userId !== 1) {
        await dataSource.query(
          `
          INSERT INTO events (
            event_name, contract, user_id, referrer_id, level_number, event_data,
            transaction_hash, block_number, block_timestamp, log_index
          ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, 1)
          ON CONFLICT (transaction_hash, log_index) DO NOTHING
          `,
          [
            'OrbitBActivated',
            'OrbitB',
            internalId,
            referrerInternalId,
            JSON.stringify({ userID: user.userId, cctAmount: '500000000000000000' }),
            user.registrationTx,
            200000 + user.userId,
            registeredAt,
          ],
        );
        eventCount++;
      }
    }

    console.log(`[SUCCESS] Inserted ${eventCount} events`);

    let paymentCount = 0;
    for (const user of users) {
      if (!user.referrerId || user.userId === 1) continue;

      const fromInternalId = idByUserId.get(user.userId)!;
      const toInternalId = idByUserId.get(user.referrerId)!;
      const txHash = `0x${user.userId.toString(16).padStart(64, '0')}`;
      const paidAt = new Date(Date.now() - (users.length - user.userId) * 12 * 60 * 60 * 1000);

      await dataSource.query(
        `
        INSERT INTO payments (
          from_user_id, to_user_id, orbit, level_number, amount, status, payment_type,
          transaction_hash, block_number, block_timestamp
        ) VALUES ($1, $2, 'ORBIT_A', 1, $3, 'RECEIVED', 'direct', $4, $5, $6)
        `,
        [fromInternalId, toInternalId, 10 + user.userId, txHash, 300000 + user.userId, paidAt],
      );

      await dataSource.query(
        `
        INSERT INTO events (
          event_name, contract, user_id, referrer_id, level_number, event_data,
          transaction_hash, block_number, block_timestamp, log_index
        ) VALUES ('PaymentSent', 'OrbitA', $1, NULL, 1, $2, $3, $4, $5, 0)
        ON CONFLICT (transaction_hash, log_index) DO NOTHING
        `,
        [
          toInternalId,
          JSON.stringify({ amount: `${10 + user.userId}`, paymentType: 'direct' }),
          txHash,
          300000 + user.userId,
          paidAt,
        ],
      );

      paymentCount++;
    }

    console.log(`[SUCCESS] Inserted ${paymentCount} sample payments`);

    await dataSource.query(
      `
      INSERT INTO announcements (title, body, is_hidden) VALUES
      ($1, $2, false),
      ($3, $4, false)
      `,
      [
        'Welcome to C-Parker',
        'Portfolio demo using real test wallet accounts from the users/ folder.',
        'Connect with MetaMask',
        'Import a test account from users/user2.json (or any user file) to explore the dashboard.',
      ],
    );

    const summary = await dataSource.query(`
      SELECT 'users' AS table_name, COUNT(*)::int AS rows FROM users
      UNION ALL SELECT 'user_levels', COUNT(*)::int FROM user_levels
      UNION ALL SELECT 'payments', COUNT(*)::int FROM payments
      UNION ALL SELECT 'events', COUNT(*)::int FROM events
    `);

    console.log('\n[SUCCESS] Seed complete');
    console.table(summary);
    console.log('\nExample wallets you can import into MetaMask:');
    for (const user of users.slice(0, 5)) {
      console.log(`  User #${user.userId}: ${user.address}  (users/user${user.userId}.json)`);
    }
  } finally {
    await dataSource.destroy();
  }
}

seedFromUsers().catch((error) => {
  console.error('[ERROR]', error.message);
  process.exit(1);
});
