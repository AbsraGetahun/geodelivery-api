import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import restaurantsRouter from './routes/restaurants.js';
import driversRouter from './routes/drivers.js';
import ordersRouter from './routes/orders.js';
import { cacheLogger } from './middleware/cacheLogger.js';
import redis from './redis/client.js';

export function createApp(): Express {
  const app = express();

  // Built-in middleware — parses JSON request bodies
  app.use(express.json());

  // Request logger middleware
  app.use(cacheLogger);

  // Health check with Redis ping
  app.get('/health', async (_req: Request, res: Response) => {
    let redisStatus: 'ok' | 'error' = 'ok';
    try {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        redisStatus = 'error';
      }
    } catch {
      redisStatus = 'error';
    }

    res.json({
      status: 'ok',
      service: 'geodelivery-api',
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    });
  });

  // Feature routers
  app.use('/restaurants', restaurantsRouter);
  app.use('/drivers', driversRouter);
  app.use('/orders', ordersRouter);

  // 404 handler (must come after all routes)
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Error handler (must have 4 args — Express uses arity to detect it)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}