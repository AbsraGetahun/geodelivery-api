import type { Request, Response, NextFunction } from 'express';
import * as restaurantService from '../services/restaurantService.js';
import { findRestaurantsNearby } from '../services/geoService.js';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limitRaw = Number(query.limit ?? 20) || 20;
  const limit = Math.min(100, Math.max(1, limitRaw));
  return { page, limit };
}

// POST /restaurants
export async function createRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, address, phone, lat, lng } = req.body ?? {};
    if (typeof name !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'name, lat, lng are required' });
    }
    const created = await restaurantService.createRestaurant({ name, address, phone, lat, lng });
    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// GET /restaurants
export async function listRestaurants(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(req.query);
    const { data, total } = await restaurantService.listRestaurants(page, limit);
    return res.json({
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
export async function getNearbyRestaurants(req: Request, res: Response, next: NextFunction) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? 2000); // default 2km

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required and must be numeric' });
    }
    if (!Number.isFinite(radius) || radius <= 0 || radius > 50_000) {
      return res.status(400).json({ error: 'radius must be between 0 and 50000 meters' });
    }

    const results = await findRestaurantsNearby(lat, lng, radius);
    return res.json({ data: results, count: results.length });
  } catch (err) {
    next(err);
  }
}

// GET /restaurants/:id
export async function getRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurant = await restaurantService.getRestaurantById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    return res.json(restaurant);
  } catch (err) {
    next(err);
  }
}

// PATCH /restaurants/:id
export async function updateRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await restaurantService.updateRestaurant(req.params.id, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Restaurant not found' });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /restaurants/:id
export async function deleteRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const ok = await restaurantService.deleteRestaurant(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Restaurant not found' });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}