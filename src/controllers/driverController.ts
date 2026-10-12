import type { Request, Response, NextFunction } from 'express';
import * as driverService from '../services/driverService.js';
import { findDriversNearby } from '../services/geoService.js';
import type { ValidatedReq } from '../middleware/validateRequest.js';
import type {
  CreateDriverInput,
  UpdateDriverInput,
  UpdateDriverLocationInput,
  UpdateDriverAvailabilityInput,
  NearbyDriverInput,
  ListDriversInput,
  DriverIdInput,
} from '../schemas/driverSchema.js';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limitRaw = Number(query.limit ?? 20) || 20;
  const limit = Math.min(100, Math.max(1, limitRaw));
  return { page, limit };
}

function getIdParam(req: Request): string {
  const vParams = (req as ValidatedReq).validatedParams as DriverIdInput | undefined;
  if (vParams?.id) return vParams.id;
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// POST /drivers
export async function createDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, phone, lat, lng } = req.body as CreateDriverInput;
    const created = await driverService.createDriver({ name, phone, lat, lng });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// GET /drivers
export async function listDrivers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vQuery = (req as ValidatedReq).validatedQuery as ListDriversInput | undefined;
    const { page, limit } = vQuery ?? parsePagination(req.query);
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
    const vQuery = (req as ValidatedReq).validatedQuery as NearbyDriverInput | undefined;
    const lat = vQuery?.lat ?? Number(req.query.lat);
    const lng = vQuery?.lng ?? Number(req.query.lng);
    const radius = vQuery?.radius ?? Number(req.query.radius ?? 2000);

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
    const id = getIdParam(req);
    const body = req.body as UpdateDriverInput;
    const updated = await driverService.updateDriver(id, body ?? {});
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
    const id = getIdParam(req);
    const { lat, lng } = req.body as UpdateDriverLocationInput;
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
    const id = getIdParam(req);
    const { is_available } = req.body as UpdateDriverAvailabilityInput;
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
