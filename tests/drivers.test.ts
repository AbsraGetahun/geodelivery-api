import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { closeRedis } from '../src/redis/client.js';
import { resetDb, flushRedis, closePool } from './setup.js';

describe('Drivers Integration Tests', () => {
  const app = createApp();
  let seededDriverIds: string[] = [];

  beforeEach(async () => {
    const { driverIds } = await resetDb();
    seededDriverIds = driverIds;
    await flushRedis();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeRedis();
    await closePool();
  });

  it('a) GET /drivers lists 3 drivers', async () => {
    const res = await request(app).get('/drivers');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  it('b) POST /drivers creates driver (201)', async () => {
    const newDriver = {
      name: 'Driver Delta',
      phone: '+251922000004',
      lat: 9.021,
      lng: 38.749,
    };
    const res = await request(app).post('/drivers').send(newDriver);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Driver Delta');
    expect(res.body.is_available).toBe(true);
    expect(res.body.lat).toBe(9.021);
    expect(res.body.lng).toBe(38.749);
    expect(res.body.id).toBeDefined();
  });

  it('c) PATCH /drivers/:id/location updates lat/lng in the response', async () => {
    const targetId = seededDriverIds[0];
    const res = await request(app).patch(`/drivers/${targetId}/location`).send({
      lat: 9.035,
      lng: 38.765,
    });
    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(9.035);
    expect(res.body.lng).toBe(38.765);
  });

  it('d) PATCH /drivers/:id/availability with { is_available: false } updates the flag', async () => {
    const targetId = seededDriverIds[0];
    const res = await request(app).patch(`/drivers/${targetId}/availability`).send({
      is_available: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.is_available).toBe(false);
  });

  it('e) GET /drivers/nearby only returns AVAILABLE drivers', async () => {
    const targetId = seededDriverIds[0];
    // Mark one driver as unavailable
    await request(app).patch(`/drivers/${targetId}/availability`).send({
      is_available: false,
    });

    const res = await request(app).get('/drivers/nearby?lat=9.0192&lng=38.7525&radius=5000');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const returnedIds = res.body.data.map((d: { id: string }) => d.id);
    expect(returnedIds).not.toContain(targetId);
  });

  it('f) GET /drivers/nearby sorts by distance_meters ASC', async () => {
    const res = await request(app).get('/drivers/nearby?lat=9.0192&lng=38.7525&radius=5000');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    const distances = res.body.data.map((d: { distance_meters: number }) => d.distance_meters);
    expect(distances[0]).toBeLessThanOrEqual(distances[1]);
    expect(distances[1]).toBeLessThanOrEqual(distances[2]);
  });

  it('g) DELETE /drivers/:id returns 204', async () => {
    const targetId = seededDriverIds[0];
    const deleteRes = await request(app).delete(`/drivers/${targetId}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/drivers/${targetId}`);
    expect(getRes.status).toBe(404);
  });

  it('h) Invalid UUID returns 400', async () => {
    const res = await request(app).get('/drivers/not-a-valid-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});
