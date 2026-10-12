import 'dotenv/config';
import { Pool } from 'pg';
import redis from '../src/redis/client.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface ResetDbResult {
  restaurantIds: string[];
  driverIds: string[];
}

export async function resetDb(): Promise<ResetDbResult> {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE orders, drivers, restaurants RESTART IDENTITY CASCADE;');

    // 3 restaurants near Addis Ababa center (9.0192, 38.7525)
    // ST_MakePoint(lng, lat)
    const restaurantRes = await client.query(`
      INSERT INTO restaurants (id, name, address, phone, location, updated_at)
      VALUES
        (gen_random_uuid(), 'Test Bole', 'Bole Road', '+251911000001', ST_SetSRID(ST_MakePoint(38.7500, 9.0200), 4326)::geography, NOW()),
        (gen_random_uuid(), 'Test Piassa', 'Piassa Center', '+251911000002', ST_SetSRID(ST_MakePoint(38.7550, 9.0150), 4326)::geography, NOW()),
        (gen_random_uuid(), 'Test Lebu', 'Lebu Mebrathail', '+251911000003', ST_SetSRID(ST_MakePoint(38.7450, 9.0250), 4326)::geography, NOW())
      RETURNING id;
    `);

    // 3 drivers, all is_available=true
    const driverRes = await client.query(`
      INSERT INTO drivers (id, name, phone, is_available, location, updated_at)
      VALUES
        (gen_random_uuid(), 'Driver Alpha', '+251922000001', true, ST_SetSRID(ST_MakePoint(38.7520, 9.0195), 4326)::geography, NOW()),
        (gen_random_uuid(), 'Driver Beta', '+251922000002', true, ST_SetSRID(ST_MakePoint(38.7480, 9.0220), 4326)::geography, NOW()),
        (gen_random_uuid(), 'Driver Gamma', '+251922000003', true, ST_SetSRID(ST_MakePoint(38.7600, 9.0300), 4326)::geography, NOW())
      RETURNING id;
    `);

    const restaurantIds = restaurantRes.rows.map((r: { id: string }) => r.id);
    const driverIds = driverRes.rows.map((r: { id: string }) => r.id);

    return { restaurantIds, driverIds };
  } finally {
    client.release();
  }
}

export async function flushRedis(): Promise<void> {
  await redis.flushall();
}

export async function closePool(): Promise<void> {
  await pool.end();
}
