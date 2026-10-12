import { z } from 'zod';

export const CreateRestaurantBody = z.object({
  name: z.string().trim().min(1).max(255),
  address: z.string().max(1000).optional(),
  phone: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const UpdateRestaurantBody = CreateRestaurantBody.partial();

export const NearbyRestaurantQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().positive().max(50000).default(2000),
});

export const ListRestaurantsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const RestaurantIdParam = z.object({
  id: z.string().uuid(),
});

export type CreateRestaurantInput = z.infer<typeof CreateRestaurantBody>;
export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantBody>;
export type NearbyRestaurantInput = z.infer<typeof NearbyRestaurantQuery>;
export type ListRestaurantsInput = z.infer<typeof ListRestaurantsQuery>;
export type RestaurantIdInput = z.infer<typeof RestaurantIdParam>;
