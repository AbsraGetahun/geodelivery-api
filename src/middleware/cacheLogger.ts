import type { Request, Response, NextFunction } from 'express';

export function cacheLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[req] ${req.method} ${req.originalUrl || req.url} ${duration}ms`);
  });

  next();
}
