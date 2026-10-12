import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { closeRedis } from '../src/redis/client.js';
import { closePool } from './setup.js';

describe('Health Check Integration', () => {
  const app = createApp();

  afterAll(async () => {
    await prisma.$disconnect();
    await closeRedis();
    await closePool();
  });

  it('GET /health returns 200 and ok statuses', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'geodelivery-api',
      redis: 'ok',
    });
    expect(typeof res.body.timestamp).toBe('string');
  });
});
