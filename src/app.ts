import express, { type Express, type Request, type Response, type NextFunction } from 'express';

export function createApp(): Express {
  const app = express();

  // Built-in middleware — parses JSON request bodies
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'geodelivery-api',
      timestamp: new Date().toISOString(),
    });
  });

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
