// Simple in-memory rate limiter for client-side protection
// Note: This is client-side only and can be bypassed. Backend rate limiting is essential.

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Check if we're in development mode
const isDev = __DEV__ || process.env.NODE_ENV === 'development';

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    // Default: 5 attempts per 15 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  private getKey(identifier: string): string {
    return `rate_limit_${identifier}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (now > entry.resetTime) {
        this.attempts.delete(key);
      }
    }
  }

  canAttempt(identifier: string): boolean {
    // Bypass rate limiting in development mode
    if (isDev) {
      return true;
    }

    this.cleanup();
    const key = this.getKey(identifier);
    const entry = this.attempts.get(key);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      // No entry or window expired, allow attempt
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxAttempts) {
      return false;
    }

    entry.count++;
    return true;
  }

  getRemainingAttempts(identifier: string): number {
    // Return unlimited attempts in development mode
    if (isDev) {
      return Infinity;
    }

    this.cleanup();
    const key = this.getKey(identifier);
    const entry = this.attempts.get(key);

    if (!entry) {
      return this.maxAttempts;
    }

    return Math.max(0, this.maxAttempts - entry.count);
  }

  getTimeUntilReset(identifier: string): number {
    // Return 0 (no wait) in development mode
    if (isDev) {
      return 0;
    }

    this.cleanup();
    const key = this.getKey(identifier);
    const entry = this.attempts.get(key);

    if (!entry) {
      return 0;
    }

    const remaining = entry.resetTime - Date.now();
    return Math.max(0, remaining);
  }

  reset(identifier: string): void {
    const key = this.getKey(identifier);
    this.attempts.delete(key);
  }
}

// Export singleton instances for login and register
export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
export const registerRateLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 attempts per hour
