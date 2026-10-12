import { prisma } from '../db/prisma.js';

export interface CreateRestaurantInput {
  name: string;
  address?: string;
  phone?: string;
  lat: number;
  lng: number;
}

export interface UpdateRestaurantInput {
  name?: string;
  address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

export async function createRestaurant(input: CreateRestaurantInput) {
  // Insert base row via Prisma, then set the geography column via raw SQL
  const created = await prisma.restaurant.create({
    data: {
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
    },
  });

  await prisma.$executeRaw`
    UPDATE restaurants
    SET location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        updated_at = NOW()
    WHERE id = ${created.id}::uuid
  `;

  return getRestaurantById(created.id);
}

export async function listRestaurants(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [total, data] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  return { data, total };
}

export async function getRestaurantById(id: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      address: string | null;
      phone: string | null;
      lat: number | null;
      lng: number | null;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    SELECT
      id, name, address, phone,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      created_at, updated_at
    FROM restaurants
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateRestaurant(id: string, input: UpdateRestaurantInput) {
  // Build partial update for non-spatial fields
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.address !== undefined) data.address = input.address;
  if (input.phone !== undefined) data.phone = input.phone;

  if (Object.keys(data).length > 0) {
    await prisma.restaurant.update({ where: { id }, data });
  }

  // If lat/lng provided, update geography column
  if (input.lat !== undefined && input.lng !== undefined) {
    await prisma.$executeRaw`
      UPDATE restaurants
      SET location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  return getRestaurantById(id);
}

export async function deleteRestaurant(id: string) {
  const existing = await prisma.restaurant.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.restaurant.delete({ where: { id } });
  return true;
}