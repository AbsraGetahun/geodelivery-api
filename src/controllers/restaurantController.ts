import type { Request, Response, NextFunction } from 'express';
import * as restaurantService from '../services/restaurantService.js';
import { findRestaurantsNearby } from '../services/geoService.js';
import type { ValidatedReq } from '../middleware/validateRequest.js';
import type {
  CreateRestaurantInput,
  UpdateRestaurantInput,
  NearbyRestaurantInput,
  ListRestaurantsInput,
  RestaurantIdInput,
} from '../schemas/restaurantSchema.js';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limitRaw = Number(query.limit ?? 20) || 20;
  const limit = Math.min(100, Math.max(1, limitRaw));
  return { page, limit };
}

function getIdParam(req: Request): string {
  const vParams = (req as ValidatedReq).validatedParams as RestaurantIdInput | undefined;
  if (vParams?.id) return vParams.id;
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// POST /restaurants
export async function createRestaurant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, address, phone, lat, lng } = req.body as CreateRestaurantInput;
    const created = await restaurantService.createRestaurant({ name, address, phone, lat, lng });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// GET /restaurants
export async function listRestaurants(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const vQuery = (req as ValidatedReq).validatedQuery as ListRestaurantsInput | undefined;
    const { page, limit } = vQuery ?? parsePagination(req.query);
    const { data, total } = await restaurantService.listRestaurants(page, limit);
    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /restaurants/nearby?lat=&lng=&radius=
export async function getNearbyRestaurants(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const vQuery = (req as ValidatedReq).validatedQuery as NearbyRestaurantInput | undefined;
    const lat = vQuery?.lat ?? Number(req.query.lat);
    const lng = vQuery?.lng ?? Number(req.query.lng);
    const radius = vQuery?.radius ?? Number(req.query.radius ?? 2000);

    const results = await findRestaurantsNearby(lat, lng, radius);
    res.json({ data: results, count: results.length });
  } catch (err) {
    next(err);
  }
}

// GET /restaurants/:id
export async function getRestaurant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getIdParam(req);
    const restaurant = await restaurantService.getRestaurantById(id);
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    res.json(restaurant);
  } catch (err) {
    next(err);
  }
}

// PATCH /restaurants/:id
export async function updateRestaurant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getIdParam(req);
    const body = req.body as UpdateRestaurantInput;
    const updated = await restaurantService.updateRestaurant(id, body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /restaurants/:id
export async function deleteRestaurant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getIdParam(req);
    const ok = await restaurantService.deleteRestaurant(id);
    if (!ok) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}