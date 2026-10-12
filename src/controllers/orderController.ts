import type { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/orderService.js';
import { calculateEta } from '../services/geoService.js';

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

// POST /orders
export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customer_name, customer_phone, restaurant_id, total_amount, lat, lng } = req.body ?? {};

    if (
      typeof customer_name !== 'string' ||
      typeof restaurant_id !== 'string' ||
      typeof total_amount !== 'number' ||
      typeof lat !== 'number' ||
      typeof lng !== 'number'
    ) {
      res.status(400).json({
        error: 'customer_name, restaurant_id, total_amount, lat, lng are required with valid types',
      });
      return;
    }

    if (customer_phone !== undefined && typeof customer_phone !== 'string') {
      res.status(400).json({ error: 'customer_phone must be a string' });
      return;
    }

    const result = await orderService.createOrder({
      customerName: customer_name,
      customerPhone: customer_phone,
      restaurantId: restaurant_id,
      totalAmount: total_amount,
      lat,
      lng,
    });

    if ('error' in result) {
      if (result.error === 'restaurant_not_found') {
        res.status(404).json({ error: 'Restaurant not found' });
        return;
      }
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /orders
export async function listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const fromDate = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toDate = typeof req.query.to === 'string' ? req.query.to : undefined;

    const { data, total } = await orderService.listOrders({
      page,
      limit,
      status,
      fromDate,
      toDate,
    });

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

// GET /orders/:id
export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getIdParam(req);
    const order = await orderService.getOrderById(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// PATCH /orders/:id/status
export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body ?? {};

    if (typeof status !== 'string' || !orderService.VALID_ORDER_STATUSES.includes(status as orderService.OrderStatus)) {
      res.status(400).json({
        error: `status must be one of: ${orderService.VALID_ORDER_STATUSES.join(', ')}`,
      });
      return;
    }

    const id = getIdParam(req);
    const updated = await orderService.updateOrderStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /orders/:id
export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getIdParam(req);
    const result = await orderService.cancelOrder(id);

    if (!result.ok) {
      if (result.reason === 'not_found') {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      if (result.reason === 'invalid_state') {
        res.status(409).json({
          error: `Cannot cancel order with status '${result.order?.status}'`,
        });
        return;
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// PATCH /orders/:id/assign
export async function assignDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { driver_id } = req.body ?? {};

    if (typeof driver_id !== 'string') {
      res.status(400).json({ error: 'driver_id is required and must be a string' });
      return;
    }

    const id = getIdParam(req);
    const result = await orderService.assignDriverToOrder(id, driver_id);

    if ('error' in result) {
      if (result.error === 'driver_not_found') {
        res.status(404).json({ error: 'Driver not found' });
        return;
      }
      if (result.error === 'order_not_found') {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      if (result.error === 'driver_unavailable') {
        res.status(400).json({ error: 'Driver is not available' });
        return;
      }
      if (result.error === 'order_already_assigned') {
        res.status(409).json({ error: 'Order already has an assigned driver' });
        return;
      }
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result.order);
  } catch (err) {
    next(err);
  }
}

// GET /orders/:id/eta
export async function getEta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getIdParam(req);
    const order = await orderService.getOrderById(id);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (!order.driver_id) {
      res.status(400).json({ error: 'Order has no assigned driver' });
      return;
    }

    const eta = await calculateEta(order.driver_id, order.id);
    if (!eta) {
      res.status(404).json({ error: 'Unable to calculate ETA: driver or order location missing' });
      return;
    }

    res.json(eta);
  } catch (err) {
    next(err);
  }
}
