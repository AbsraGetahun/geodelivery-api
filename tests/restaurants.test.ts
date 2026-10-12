import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { closeRedis } from '../src/redis/client.js';
import { resetDb, flushRedis, closePool } from './setup.js';

describe('Restaurants Integration Tests', () => {
  const app = createApp();
  let seededRestaurantIds: string[] = [];

  beforeEach(async () => {
    const { restaurantIds } = await resetDb();
    seededRestaurantIds = restaurantIds;
    await flushRedis();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeRedis();
    await closePool();
  });

  it('a) GET /restaurants returns paginated data (3 seeded)', async () => {
    const res = await request(app).get('/restaurants');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
  });

  it('b) POST /restaurants creates a restaurant (201)', async () => {
    const newRestaurant = {
      name: 'New Restaurant',
      address: 'Kazanchis',
      phone: '+251911999999',
      lat: 9.018,
      lng: 38.751,
    };
    const res = await request(app).post('/restaurants').send(newRestaurant);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'New Restaurant',
      address: 'Kazanchis',
      phone: '+251911999999',
      lat: 9.018,
      lng: 38.751,
    });
    expect(res.body.id).toBeDefined();
  });

  it('c) POST /restaurants without name returns 400 with details array', async () => {
    const res = await request(app).post('/restaurants').send({
      lat: 9.018,
      lng: 38.751,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('d) POST /restaurants with lat=200 returns 400', async () => {
    const res = await request(app).post('/restaurants').send({
      name: 'Invalid Lat',
      lat: 200,
      lng: 38.751,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('e) GET /restaurants/:id returns the restaurant with lat/lng', async () => {
    const targetId = seededRestaurantIds[0];
    const res = await request(app).get(`/restaurants/${targetId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetId);
    expect(res.body.lat).toBeDefined();
    expect(res.body.lng).toBeDefined();
  });

  it('f) GET /restaurants/not-a-uuid returns 400 (Zod UUID validation)', async () => {
    const res = await request(app).get('/restaurants/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('g) GET /restaurants/00000000-0000-0000-0000-000000000000 returns 404', async () => {
    const res = await request(app).get('/restaurants/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Restaurant not found');
  });

  it('h) GET /restaurants/nearby?lat=9.0192&lng=38.7525&radius=2000 returns all 3 restaurants sorted by distance', async () => {
    const res = await request(app).get('/restaurants/nearby?lat=9.0192&lng=38.7525&radius=2000');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    const distances = res.body.data.map((r: { distance_meters: number }) => r.distance_meters);
    expect(distances[0]).toBeLessThanOrEqual(distances[1]);
    expect(distances[1]).toBeLessThanOrEqual(distances[2]);
  });

  it('i) GET /restaurants/nearby?lat=9.0192&lng=38.7525&radius=100 returns a smaller subset', async () => {
    const res = await request(app).get('/restaurants/nearby?lat=9.0192&lng=38.7525&radius=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThan(3);
  });

  it('j) GET /restaurants/nearby without lat returns 400', async () => {
    const res = await request(app).get('/restaurants/nearby?lng=38.7525&radius=2000');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('k) PATCH /restaurants/:id updates name', async () => {
    const targetId = seededRestaurantIds[0];
    const res = await request(app).patch(`/restaurants/${targetId}`).send({
      name: 'Updated Bole Name',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Bole Name');
  });

  it('l) DELETE /restaurants/:id returns 204 and subsequent GET returns 404', async () => {
    const targetId = seededRestaurantIds[0];
    const deleteRes = await request(app).delete(`/restaurants/${targetId}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/restaurants/${targetId}`);
    expect(getRes.status).toBe(404);
  });

  it('m) CACHE: two identical nearby GETs should both return 200 with the same data', async () => {
    const query = '/restaurants/nearby?lat=9.0192&lng=38.7525&radius=2000';
    const firstRes = await request(app).get(query);
    expect(firstRes.status).toBe(200);

    const secondRes = await request(app).get(query);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toEqual(firstRes.body);
  });
});
