import type { Request, Response, NextFunction } from 'express';
import * as driverService from '../services/driverService.js';
import { findDriversNearby } from '../services/geoService.js';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limitRaw = Number(query.limit ?? 20) || 20;
  const limit = Math.min(100, Math.max(1, limitRaw));
  return { page, limit };
}

function getIdParam(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// POST /drivers
export async function createDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, phone, lat, lng } = req.body ?? {};

    if (typeof name !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'name, lat, lng are required' });
      return;
    }

    if (phone !== undefined && typeof phone !== 'string') {
      res.status(400).json({ error: 'phone must be a string' });
      return;
    }

    const created = await driverService.createDriver({ name, phone, lat, lng });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// GET /drivers
export async function listDrivers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query);
    const { data, total } = await driverService.listDrivers(page, limit);
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

// GET /drivers/nearby?lat=&lng=&radius=
export async function getNearbyDrivers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? 2000); // default 2000m

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat and lng are required and must be numeric' });
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0 || radius > 50_000) {
      res.status(400).json({ error: 'radius must be between 0 and 50000 meters' });
      return;
    }

    const results = await findDriversNearby(lat, lng, radius);
    res.json({ data: results, count: results.length });
  } catch (err) {
    next(err);
  }
}

// GET /drivers/:id
export async function getDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getIdParam(req);
    const driver = await driverService.getDriverById(id);
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json(driver);
  } catch (err) {
    next(err);
  }
}

// PATCH /drivers/:id
export async function updateDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body ?? {};
    const { name, phone, lat, lng } = body;

    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({ error: 'name must be a string' });
      return;
    }
    if (phone !== undefined && typeof phone !== 'string') {
      res.status(400).json({ error: 'phone must be a string' });
      return;
    }
    if (lat !== undefined && typeof lat !== 'number') {
      res.status(400).json({ error: 'lat must be a number' });
      return;
    }
    if (lng !== undefined && typeof lng !== 'number') {
      res.status(400).json({ error: 'lng must be a number' });
      return;
    }

    const id = getIdParam(req);
    const updated = await driverService.updateDriver(id, { name, phone, lat, lng });
    if (!updated) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /drivers/:id/location
export async function updateDriverLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { lat, lng } = req.body ?? {};

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng are required and must be numbers' });
      return;
    }

    const id = getIdParam(req);
    const updated = await driverService.updateDriverLocation(id, lat, lng);
    if (!updated) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /drivers/:id/availability
export async function updateDriverAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { is_available } = req.body ?? {};

    if (typeof is_available !== 'boolean') {
      res.status(400).json({ error: 'is_available is required and must be a boolean' });
      return;
    }

    const id = getIdParam(req);
    const updated = await driverService.setDriverAvailability(id, is_available);
    if (!updated) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /drivers/:id
export async function deleteDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getIdParam(req);
    const ok = await driverService.deleteDriver(id);
    if (!ok) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
