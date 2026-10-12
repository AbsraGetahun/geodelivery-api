import { prisma } from '../db/prisma.js';

export interface CreateDriverInput {
  name: string;
  phone?: string;
  lat: number;
  lng: number;
}

export interface UpdateDriverInput {
  name?: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

export interface DriverRecord {
  id: string;
  name: string;
  phone: string | null;
  is_available: boolean;
  lat: number | null;
  lng: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function createDriver(input: CreateDriverInput): Promise<DriverRecord | null> {
  const created = await prisma.driver.create({
    data: {
      name: input.name,
      phone: input.phone ?? null,
    },
  });

  await prisma.$executeRaw`
    UPDATE drivers
    SET location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
        updated_at = NOW()
    WHERE id = ${created.id}::uuid
  `;

  return getDriverById(created.id);
}

export async function listDrivers(page: number, limit: number): Promise<{ data: DriverRecord[]; total: number }> {
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.driver.count(),
    prisma.$queryRaw<DriverRecord[]>`
      SELECT
        id,
        name,
        phone,
        is_available,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        created_at,
        updated_at
      FROM drivers
      ORDER BY created_at DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `,
  ]);

  return { data: rows, total };
}

export async function getDriverById(id: string): Promise<DriverRecord | null> {
  const rows = await prisma.$queryRaw<DriverRecord[]>`
    SELECT
      id,
      name,
      phone,
      is_available,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      created_at,
      updated_at
    FROM drivers
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function updateDriver(id: string, input: UpdateDriverInput): Promise<DriverRecord | null> {
  const existing = await prisma.driver.findUnique({ where: { id } });
  if (!existing) return null;

  const data: { name?: string; phone?: string | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = input.phone;

  if (Object.keys(data).length > 0) {
    await prisma.driver.update({ where: { id }, data });
  }

  if (input.lat !== undefined && input.lng !== undefined) {
    await prisma.$executeRaw`
      UPDATE drivers
      SET location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  return getDriverById(id);
}

export async function updateDriverLocation(id: string, lat: number, lng: number): Promise<DriverRecord | null> {
  const existing = await prisma.driver.findUnique({ where: { id } });
  if (!existing) return null;

  await prisma.$executeRaw`
    UPDATE drivers
    SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        updated_at = NOW()
    WHERE id = ${id}::uuid
  `;

  return getDriverById(id);
}

export async function setDriverAvailability(id: string, isAvailable: boolean): Promise<DriverRecord | null> {
  const existing = await prisma.driver.findUnique({ where: { id } });
  if (!existing) return null;

  await prisma.driver.update({
    where: { id },
    data: { isAvailable },
  });

  return getDriverById(id);
}

export async function deleteDriver(id: string): Promise<boolean> {
  const existing = await prisma.driver.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.driver.delete({ where: { id } });
  return true;
}
