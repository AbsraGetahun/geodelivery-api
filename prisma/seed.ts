import 'dotenv/config';
import { Pool } from 'pg';

/**
 * GeoDelivery API - seed script
 * Run with: npx tsx prisma/seed.ts
 *
 * Uses raw pg (not Prisma Client) because PostGIS GEOGRAPHY
 * columns can't be inserted through Prisma's typed API.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Addis Ababa, Ethiopia — approximate city center: 9.0192, 38.7525
const CITY_CENTER = { lat: 9.0192, lng: 38.7525 };

// Helper: jitter a coordinate by ~0.005 degrees (about 500m)
function jitter(base: number, range = 0.02): number {
  return base + (Math.random() - 0.5) * range;
}

// Restaurants with real-ish Addis neighborhoods
const RESTAURANTS = [
  { name: 'Bole Kitchen',       address: 'Bole Road, Addis Ababa',        phone: '+251911000001' },
  { name: 'Piassa Bistro',      address: 'Piassa, Addis Ababa',           phone: '+251911000002' },
  { name: 'Kazanchis Grill',    address: 'Kazanchis, Addis Ababa',        phone: '+251911000003' },
  { name: 'Sarbet Cafe',        address: 'Sarbet, Addis Ababa',           phone: '+251911000004' },
  { name: 'Megenagna Burger',   address: 'Megenagna, Addis Ababa',        phone: '+251911000005' },
  { name: 'Gerji Pizza',        address: 'Gerji, Addis Ababa',            phone: '+251911000006' },
  { name: 'CMC Injera House',   address: 'CMC, Addis Ababa',              phone: '+251911000007' },
  { name: 'Summit Sushi',       address: 'Summit, Addis Ababa',           phone: '+251911000008' },
  { name: 'Ayat Cafe',          address: 'Ayat, Addis Ababa',             phone: '+251911000009' },
  { name: 'Lebu Noodle Bar',    address: 'Lebu, Addis Ababa',             phone: '+251911000010' },
  { name: 'Merkato Street Food',address: 'Merkato, Addis Ababa',          phone: '+251911000011' },
  { name: 'Old Airport Diner',  address: 'Old Airport, Addis Ababa',      phone: '+251911000012' },
];

// Driver pool
const DRIVER_FIRST_NAMES = [
  'Abebe', 'Sara', 'Daniel', 'Hanna', 'Yohannes', 'Marta', 'Samuel',
  'Selam', 'Tesfaye', 'Ruth', 'Kalkidan', 'Bereket', 'Liya', 'Nahom',
  'Bethel', 'Ermias', 'Meron', 'Fitsum', 'Rahel', 'Yonatan', 'Sofia',
  'Amanuel',
];

const ORDER_STATUSES = [
  'pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled',
] as const;

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding database...');

    // 1. Wipe tables (order matters for FKs)
    await client.query('TRUNCATE orders, drivers, restaurants RESTART IDENTITY CASCADE');
    console.log('   Cleared existing data.');

    // 2. Insert restaurants
    const restaurantIds: string[] = [];
    for (const r of RESTAURANTS) {
      const lat = jitter(CITY_CENTER.lat);
      const lng = jitter(CITY_CENTER.lng);
      const result = await client.query(
        `INSERT INTO restaurants (id, name, address, phone, location, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3,
                 ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, NOW())
         RETURNING id`,
        [r.name, r.address, r.phone, lng, lat]
      );
      restaurantIds.push(result.rows[0].id);
    }
    console.log(`   Inserted ${restaurantIds.length} restaurants.`);

    // 3. Insert drivers
    const driverIds: string[] = [];
    for (let i = 0; i < DRIVER_FIRST_NAMES.length; i++) {
      const name = DRIVER_FIRST_NAMES[i];
      const phone = `+2519220000${String(i + 1).padStart(2, '0')}`;
      const lat = jitter(CITY_CENTER.lat, 0.05);
      const lng = jitter(CITY_CENTER.lng, 0.05);
      const isAvailable = Math.random() > 0.3; // ~70% available
      const result = await client.query(
        `INSERT INTO drivers (id, name, phone, is_available, location, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3,
                 ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, NOW())
         RETURNING id`,
        [name, phone, isAvailable, lng, lat]
      );
      driverIds.push(result.rows[0].id);
    }
    console.log(`   Inserted ${driverIds.length} drivers.`);

    // 4. Insert orders
    const orderCount = 40;
    let insertedOrders = 0;
    for (let i = 0; i < orderCount; i++) {
      const restaurantId = restaurantIds[Math.floor(Math.random() * restaurantIds.length)];
      const driverId = Math.random() > 0.3
        ? driverIds[Math.floor(Math.random() * driverIds.length)]
        : null;
      const status = ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)];
      const customerLat = jitter(CITY_CENTER.lat, 0.06);
      const customerLng = jitter(CITY_CENTER.lng, 0.06);
      const totalAmount = (Math.random() * 2000 + 200).toFixed(2);
      const deliveredAt = status === 'delivered' ? new Date() : null;

      await client.query(
        `INSERT INTO orders
           (id, customer_name, customer_phone, restaurant_id, driver_id,
            status, total_amount, customer_location, created_at, delivered_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6,
            ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
            NOW() - ($9 || ' hours')::interval,
            $10)`,
        [
          `Customer ${i + 1}`,
          `+2519330000${String(i + 1).padStart(2, '0')}`,
          restaurantId,
          driverId,
          status,
          totalAmount,
          customerLng,
          customerLat,
          Math.floor(Math.random() * 72), // 0 to 72 hours ago
          deliveredAt,
        ]
      );
      insertedOrders++;
    }
    console.log(`   Inserted ${insertedOrders} orders.`);

    // 5. Quick summary
    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM restaurants) AS restaurants,
        (SELECT COUNT(*) FROM drivers)     AS drivers,
        (SELECT COUNT(*) FROM orders)      AS orders
    `);
    console.log('✅ Seed complete:', summary.rows[0]);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();