import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config";
import { RateLimitError } from "../utils/errors";

const MAX_BUCKETS = 10_000;

class MemoryRateLimiter {
  private buckets = new Map<string, { timestamps: number[] }>();
  private concurrency = 0;

  check(key: string, maxRequests: number, maxConcurrency: number): void {
    if (this.concurrency >= maxConcurrency) {
      throw new RateLimitError("Too many concurrent requests");
    }

    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= MAX_BUCKETS) {
        // Evict oldest bucket to prevent unbounded growth
        const oldest = this.buckets.keys().next().value;
        if (oldest) this.buckets.delete(oldest);
      }
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    const now = Date.now();
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
    if (bucket.timestamps.length >= maxRequests) {
      throw new RateLimitError("Request rate limit exceeded");
    }
  }

  record(key: string): void {
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.timestamps.push(Date.now());
    }
    this.concurrency++;
  }

  release(): void {
    this.concurrency = Math.max(0, this.concurrency - 1);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
      if (bucket.timestamps.length === 0) this.buckets.delete(key);
    }
  }
}

export const rateLimiter = new MemoryRateLimiter();
setInterval(() => rateLimiter.cleanup(), 5 * 60_000);

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();
  if (!config.rate_limit.enabled) return next();

  try {
    rateLimiter.check(
      req.ip || "unknown",
      config.rate_limit.requests_per_minute,
      config.rate_limit.concurrency
    );
  } catch (err) {
    return next(err);
  }

  rateLimiter.record(req.ip || "unknown");

  // Release on finish, close, or error — prevents concurrency leak on disconnects
  const release = () => rateLimiter.release();
  res.on("finish", release);
  res.on("close", release);
  res.on("error", release);

  next();
}
