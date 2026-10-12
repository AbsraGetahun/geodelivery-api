import { prisma } from '../db/prisma.js';
import type { RestaurantWithDistance } from '../types/index.js';

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