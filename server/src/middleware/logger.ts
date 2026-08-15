import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[API ${req.method}] ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${req.ip}`
    );
  });
  next();
}

export function errorLogger(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    user: (req as any).user ? (req as any).user.id : 'anonymous',
  });

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: Date.now(),
  });
}
