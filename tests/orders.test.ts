import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { closeRedis } from '../src/redis/client.js';
import { resetDb, flushRedis, closePool } from './setup.js';

describe('Orders Integration Tests', () => {
  const app = createApp();
  let seededRestaurantIds: string[] = [];
  let seededDriverIds: string[] = [];

  beforeEach(async () => {
    const { restaurantIds, driverIds } = await resetDb();
    seededRestaurantIds = restaurantIds;
    seededDriverIds = driverIds;
    await flushRedis();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeRedis();
    await closePool();
  });

  it('a) POST /orders creates an order (201) with status pending and driver_id null', async () => {
    const orderData = {
      customer_name: 'Abebe Customer',
      customer_phone: '+251933000001',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 150.5,
      lat: 9.0192,
      lng: 38.7525,
    };
    const res = await request(app).post('/orders').send(orderData);
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('pending');
    expect(res.body.order.driver_id).toBeNull();
    expect(res.body.order.customer_name).toBe('Abebe Customer');
    expect(res.body.suggested_driver_id).toBeDefined();
  });

  it('b) POST /orders with a nonexistent restaurant_id returns 404', async () => {
    const orderData = {
      customer_name: 'Missing Restaurant',
      restaurant_id: '00000000-0000-0000-0000-000000000000',
      total_amount: 50.0,
      lat: 9.0192,
      lng: 38.7525,
    };
    const res = await request(app).post('/orders').send(orderData);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Restaurant not found');
  });

  it('c) POST /orders with an invalid restaurant_id (not a UUID) returns 400', async () => {
    const orderData = {
      customer_name: 'Invalid UUID',
      restaurant_id: 'not-a-uuid',
      total_amount: 50.0,
      lat: 9.0192,
      lng: 38.7525,
    };
    const res = await request(app).post('/orders').send(orderData);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('d) GET /orders lists orders with pagination', async () => {
    // Create an order first
    await request(app).post('/orders').send({
      customer_name: 'Customer 1',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });

    const res = await request(app).get('/orders');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('e) GET /orders?status=pending filters correctly', async () => {
    await request(app).post('/orders').send({
      customer_name: 'Customer Pending',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });

    const res = await request(app).get('/orders?status=pending');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const emptyRes = await request(app).get('/orders?status=delivered');
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.data).toHaveLength(0);
  });

  it('f) PATCH /orders/:id/assign with a valid driver sets status=accepted and driver_id set', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer To Assign',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;
    const driverId = seededDriverIds[0];

    const assignRes = await request(app).patch(`/orders/${orderId}/assign`).send({
      driver_id: driverId,
    });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.status).toBe('accepted');
    expect(assignRes.body.driver_id).toBe(driverId);
  });

  it('g) PATCH /orders/:id/assign twice returns 409 the second time', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer Assign Twice',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    await request(app).patch(`/orders/${orderId}/assign`).send({
      driver_id: seededDriverIds[0],
    });

    const secondAssignRes = await request(app).patch(`/orders/${orderId}/assign`).send({
      driver_id: seededDriverIds[1],
    });
    expect(secondAssignRes.status).toBe(409);
    expect(secondAssignRes.body.error).toBe('Order already has an assigned driver');
  });

  it('h) PATCH /orders/:id/status updates status; setting delivered also sets delivered_at', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer Status Update',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    const inTransitRes = await request(app).patch(`/orders/${orderId}/status`).send({
      status: 'in_transit',
    });
    expect(inTransitRes.status).toBe(200);
    expect(inTransitRes.body.status).toBe('in_transit');

    const deliveredRes = await request(app).patch(`/orders/${orderId}/status`).send({
      status: 'delivered',
    });
    expect(deliveredRes.status).toBe(200);
    expect(deliveredRes.body.status).toBe('delivered');
    expect(deliveredRes.body.delivered_at).toBeDefined();
    expect(deliveredRes.body.delivered_at).not.toBeNull();
  });

  it('i) PATCH /orders/:id/status with an invalid status returns 400', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer Bad Status',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    const res = await request(app).patch(`/orders/${orderId}/status`).send({
      status: 'unknown_status',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('j) GET /orders/:id/eta returns distance_meters > 0 and eta_seconds >= 0 when driver assigned', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer ETA',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    await request(app).patch(`/orders/${orderId}/assign`).send({
      driver_id: seededDriverIds[0],
    });

    const etaRes = await request(app).get(`/orders/${orderId}/eta`);
    expect(etaRes.status).toBe(200);
    expect(etaRes.body.distance_meters).toBeGreaterThan(0);
    expect(etaRes.body.eta_seconds).toBeGreaterThanOrEqual(0);
    expect(etaRes.body.driver_lat).toBeDefined();
    expect(etaRes.body.customer_lat).toBeDefined();
  });

  it('k) GET /orders/:id/eta on an order with no driver returns 400', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer No Driver ETA',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    const res = await request(app).get(`/orders/${orderId}/eta`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Order has no assigned driver');
  });

  it('l) DELETE /orders/:id cancels a pending order (204)', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer Cancel',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    const deleteRes = await request(app).delete(`/orders/${orderId}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/orders/${orderId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('cancelled');
  });

  it('m) DELETE /orders/:id on a delivered order returns 409', async () => {
    const createRes = await request(app).post('/orders').send({
      customer_name: 'Customer Delivered Cancel',
      restaurant_id: seededRestaurantIds[0],
      total_amount: 100.0,
      lat: 9.0192,
      lng: 38.7525,
    });
    const orderId = createRes.body.order.id;

    await request(app).patch(`/orders/${orderId}/status`).send({
      status: 'delivered',
    });

    const deleteRes = await request(app).delete(`/orders/${orderId}`);
    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.error).toContain('delivered');
  });
});
