import { prisma } from '../db/prisma.js';
import { findNearestAvailableDriver } from './geoService.js';
import { cacheDel, cacheDelPattern } from '../redis/cache.js';
import { driverById, DRIVERS_NEARBY_PATTERN } from '../redis/keys.js';

export interface CreateOrderInput {
  customerName: string;
  customerPhone?: string;
  restaurantId: string;
  totalAmount: number;
  lat: number;
  lng: number;
}

export interface ListOrdersFilter {
  page: number;
  limit: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export interface OrderDetail {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  total_amount: number | string;
  restaurant_id: string;
  driver_id: string | null;
  created_at: Date;
  delivered_at: Date | null;
  customer_lat: number | null;
  customer_lng: number | null;
  restaurant_name: string;
  restaurant_lat: number | null;
  restaurant_lng: number | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
}

export const VALID_ORDER_STATUSES = [
  'pending',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const rows = await prisma.$queryRaw<OrderDetail[]>`
    SELECT
      o.id,
      o.customer_name,
      o.customer_phone,
      o.status,
      o.total_amount,
      o.restaurant_id,
      o.driver_id,
      o.created_at,
      o.delivered_at,
      ST_Y(o.customer_location::geometry) AS customer_lat,
      ST_X(o.customer_location::geometry) AS customer_lng,
      r.name AS restaurant_name,
      ST_Y(r.location::geometry) AS restaurant_lat,
      ST_X(r.location::geometry) AS restaurant_lng,
      d.name AS driver_name,
      ST_Y(d.location::geometry) AS driver_lat,
      ST_X(d.location::geometry) AS driver_lng
    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    LEFT JOIN drivers d ON d.id = o.driver_id
    WHERE o.id = ${id}::uuid
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

export async function createOrder(
  input: CreateOrderInput
): Promise<
  | { error: 'restaurant_not_found' }
  | { order: OrderDetail; suggested_driver_id: string | null }
> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
  });

  if (!restaurant) {
    return { error: 'restaurant_not_found' };
  }

  // Find nearest available driver for suggestion (5000m radius)
  const nearestDriver = await findNearestAvailableDriver(input.lat, input.lng, 5000);

  const created = await prisma.order.create({
    data: {
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      restaurantId: input.restaurantId,
      driverId: null,
      status: 'pending',
      totalAmount: input.totalAmount,
    },
  });

  await prisma.$executeRaw`
    UPDATE orders
    SET customer_location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
    WHERE id = ${created.id}::uuid
  `;

  const order = await getOrderById(created.id);
  if (!order) {
    throw new Error('Failed to retrieve newly created order');
  }

  return {
    order,
    suggested_driver_id: nearestDriver ? nearestDriver.id : null,
  };
}

export async function listOrders(filter: ListOrdersFilter) {
  const { page, limit, status, fromDate, toDate } = filter;
  const skip = (page - 1) * limit;

  const where: {
    status?: string;
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {};

  if (status) {
    where.status = status;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = new Date(fromDate);
    }
    if (toDate) {
      where.createdAt.lte = new Date(toDate);
    }
  }

  const [total, data] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        restaurantId: true,
        driverId: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        deliveredAt: true,
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return { data, total };
}

export async function updateOrderStatus(
  id: string,
  status: string
): Promise<OrderDetail | null> {
  if (!VALID_ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new Error(`Invalid order status: ${status}`);
  }

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) return null;

  const data: { status: string; deliveredAt?: Date } = { status };
  if (status === 'delivered') {
    data.deliveredAt = new Date();
  }

  await prisma.order.update({
    where: { id },
    data,
  });

  return getOrderById(id);
}

export async function cancelOrder(id: string): Promise<
  | { ok: true; order: OrderDetail }
  | { ok: false; reason: 'not_found' | 'invalid_state'; order?: OrderDetail }
> {
  const order = await getOrderById(id);
  if (!order) {
    return { ok: false, reason: 'not_found' };
  }

  if (order.status === 'delivered' || order.status === 'cancelled') {
    return { ok: false, reason: 'invalid_state', order };
  }

    await prisma.order.update({
    where: { id },
    data: { status: 'cancelled' },
  });
  const updated = await getOrderById(id);
  if (!updated) {
    throw new Error('Order disappeared after cancel');
  }
  return { ok: true, order: updated };
}

export async function assignDriverToOrder(
  orderId: string,
  driverId: string
): Promise<
  | { error: 'driver_not_found' | 'driver_unavailable' | 'order_not_found' | 'order_already_assigned' }
  | { order: OrderDetail }
> {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) {
    return { error: 'driver_not_found' };
  }
  if (!driver.isAvailable) {
    return { error: 'driver_unavailable' };
  }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { error: 'order_not_found' };
  }
  if (order.driverId !== null) {
    return { error: 'order_already_assigned' };
  }
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return { error: 'order_already_assigned' };
  }
  const newStatus = order.status === 'pending' ? 'accepted' : order.status;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      driverId,
      status: newStatus,
    },
  });
  const updated = await getOrderById(orderId);
  if (!updated) {
    throw new Error('Order disappeared after assignment');
  }

  // Invalidate driver cache and nearby drivers cache since driver is now assigned
  await Promise.all([
    cacheDel(driverById(driverId)),
    cacheDelPattern(DRIVERS_NEARBY_PATTERN),
  ]);

  return { order: updated };
}
