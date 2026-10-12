import { prisma } from '../db/prisma.js';
import type { RestaurantWithDistance } from '../types/index.js';

export interface DriverWithDistance {
  id: string;
  name: string;
  phone: string | null;
  is_available: boolean;
  lat: number;
  lng: number;
  distance_meters: number;
}

export interface EtaResult {
  distance_meters: number;
  eta_seconds: number;
  eta_minutes: number;
  driver_lat: number;
  driver_lng: number;
  customer_lat: number;
  customer_lng: number;
}

/**
 * Find restaurants within `radiusMeters` of the given point.
 *
 * Uses PostGIS ST_DWithin (index-aware via GiST) for filtering, and
 * ST_Distance to compute exact meters for ordering + returning.
 *
 * Why raw SQL? Prisma Client cannot express spatial operators.
 * This is a common production pattern: ORM for CRUD, raw SQL for
 * DB-specific features.
 */
export async function findRestaurantsNearby(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit = 50
): Promise<RestaurantWithDistance[]> {
  const rows = await prisma.$queryRaw<RestaurantWithDistance[]>`
    SELECT
      id,
      name,
      address,
      phone,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_meters
    FROM restaurants
    WHERE location IS NOT NULL
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_meters ASC
    LIMIT ${limit};
  `;
  return rows;
}

/**
 * Find available drivers within `radiusMeters` of the given point.
 *
 * Filters: is_available = true AND location IS NOT NULL AND ST_DWithin(location, point, radiusMeters)
 * Orders by distance_meters ASC
 */
export async function findDriversNearby(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit = 50
): Promise<DriverWithDistance[]> {
  const rows = await prisma.$queryRaw<DriverWithDistance[]>`
    SELECT
      id,
      name,
      phone,
      is_available,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_meters
    FROM drivers
    WHERE is_available = true
      AND location IS NOT NULL
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_meters ASC
    LIMIT ${limit};
  `;
  return rows;
}

/**
 * Find the single nearest available driver within `radiusMeters` of the given point.
 * Used for auto-assigning or suggesting a driver for a new order.
 */
export async function findNearestAvailableDriver(
  lat: number,
  lng: number,
  radiusMeters = 5000
): Promise<DriverWithDistance | null> {
  const rows = await prisma.$queryRaw<DriverWithDistance[]>`
    SELECT
      id,
      name,
      phone,
      is_available,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_meters
    FROM drivers
    WHERE is_available = true
      AND location IS NOT NULL
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance_meters ASC
    LIMIT 1;
  `;
  return rows[0] ?? null;
}

/**
 * Calculate ETA between a driver and an order's customer location.
 * Joins drivers + orders on the given ids.
 * Formula: eta_seconds = ROUND(distance_meters / 8.0) (~8 m/s or 28.8 km/h).
 * Returns null if driver or order not found OR either location is null.
 */
export async function calculateEta(
  driverId: string,
  orderId: string
): Promise<EtaResult | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      distance_meters: number;
      driver_lat: number;
      driver_lng: number;
      customer_lat: number;
      customer_lng: number;
    }>
  >`
    SELECT
      ST_Distance(d.location, o.customer_location) AS distance_meters,
      ST_Y(d.location::geometry) AS driver_lat,
      ST_X(d.location::geometry) AS driver_lng,
      ST_Y(o.customer_location::geometry) AS customer_lat,
      ST_X(o.customer_location::geometry) AS customer_lng
    FROM drivers d
    CROSS JOIN orders o
    WHERE d.id = ${driverId}::uuid
      AND o.id = ${orderId}::uuid
      AND d.location IS NOT NULL
      AND o.customer_location IS NOT NULL
    LIMIT 1;
  `;

  if (!rows[0]) return null;

  const row = rows[0];
  const distance_meters = Number(row.distance_meters);
  const eta_seconds = Math.round(distance_meters / 8.0);
  const eta_minutes = Math.round((eta_seconds / 60) * 10) / 10;

  return {
    distance_meters,
    eta_seconds,
    eta_minutes,
    driver_lat: Number(row.driver_lat),
    driver_lng: Number(row.driver_lng),
    customer_lat: Number(row.customer_lat),
    customer_lng: Number(row.customer_lng),
  };
}