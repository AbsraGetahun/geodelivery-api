import { z } from 'zod';

export const CreateDriverBody = z.object({
  name: z.string().trim().min(1).max(255),
  phone: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const UpdateDriverBody = CreateDriverBody.partial();

export const UpdateDriverLocationBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const UpdateDriverAvailabilityBody = z.object({
  is_available: z.boolean(),
});

export const NearbyDriverQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().positive().max(50000).default(2000),
});

export const ListDriversQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const DriverIdParam = z.object({
  id: z.string().uuid(),
});

export type CreateDriverInput = z.infer<typeof CreateDriverBody>;
export type UpdateDriverInput = z.infer<typeof UpdateDriverBody>;
export type UpdateDriverLocationInput = z.infer<typeof UpdateDriverLocationBody>;
export type UpdateDriverAvailabilityInput = z.infer<typeof UpdateDriverAvailabilityBody>;
export type NearbyDriverInput = z.infer<typeof NearbyDriverQuery>;
export type ListDriversInput = z.infer<typeof ListDriversQuery>;
export type DriverIdInput = z.infer<typeof DriverIdParam>;
