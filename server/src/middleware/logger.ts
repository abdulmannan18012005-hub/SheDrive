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

export function errorLogger(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, {
    message: err?.message || err,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    user: (req as any).user ? (req as any).user.id : 'anonymous',
  });

  const statusCode = err.status || err.statusCode || 500;
  const rawMessage = err.message || 'Internal Server Error';
  
  // Sanitize internal database / syntax / connection errors in production
  let clientMessage = rawMessage;
  const isProduction = process.env.NODE_ENV === 'production';
  const containsSensitiveInfo = /syntax error|relation|column|postgresql|connect|econnrefused|password|jwt/i.test(rawMessage);
  
  if (isProduction && (statusCode === 500 || containsSensitiveInfo)) {
    clientMessage = 'An unexpected server error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    error: clientMessage,
    timestamp: Date.now(),
  });
}
