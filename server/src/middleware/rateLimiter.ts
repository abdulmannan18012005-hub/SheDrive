/**
 * Simple in-memory rate limiter for protecting sensitive endpoints
 * No external dependencies required
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiter middleware factory
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param keyGenerator - Function to extract rate limit key from request (defaults to IP)
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyGenerator?: (req: any) => string
) {
  return (req: any, res: any, next: any) => {
    const key = keyGenerator ? keyGenerator(req) : getClientIp(req);
    const now = Date.now();

    const existing = rateLimitStore.get(key);

    // Clean up expired entries
    if (existing && now > existing.resetAt) {
      rateLimitStore.delete(key);
    }

    const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
      });
    }

    rateLimitStore.set(key, entry);
    next();
  };
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

/**
 * Clean up expired entries periodically (every 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Pre-configured rate limiters for common use cases
 */
export const loginRateLimiter = createRateLimiter(
  20, // 20 requests
  5 * 60 * 1000, // per 5 minutes
  (req) => getClientIp(req) // Rate limit by IP
);

export const otpRateLimiter = createRateLimiter(
  5, // 5 OTP requests
  5 * 60 * 1000, // per 5 minutes
  (req) => {
    // Rate limit by email for OTP endpoints
    const email = req.body?.email || req.query?.email;
    return email ? `otp:${email.trim().toLowerCase()}` : getClientIp(req);
  }
);

export const passwordResetRateLimiter = createRateLimiter(
  3, // 3 password reset requests
  15 * 60 * 1000, // per 15 minutes
  (req) => {
    // Rate limit by email for password reset
    const email = req.body?.email || req.query?.email;
    return email ? `reset:${email.trim().toLowerCase()}` : getClientIp(req);
  }
);
