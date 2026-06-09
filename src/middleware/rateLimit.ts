import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config";
import { RateLimitError } from "../utils/errors";

class MemoryRateLimiter {
  private buckets = new Map<string, { timestamps: number[]; tokens: number }>();
  private concurrency = 0;

  check(key: string, maxRequests: number, maxTokens: number, maxConcurrency: number): void {
    if (this.concurrency >= maxConcurrency) {
      throw new RateLimitError("Too many concurrent requests");
    }

    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { timestamps: [], tokens: 0 }; this.buckets.set(key, bucket); }

    const now = Date.now();
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
    if (bucket.timestamps.length >= maxRequests) throw new RateLimitError("Request rate limit exceeded");
    if (bucket.tokens >= maxTokens) throw new RateLimitError("Token rate limit exceeded");
  }

  record(key: string): void {
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { timestamps: [], tokens: 0 }; this.buckets.set(key, bucket); }
    bucket.timestamps.push(Date.now());
    this.concurrency++;
  }

  release(): void { this.concurrency = Math.max(0, this.concurrency - 1); }

  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
      if (bucket.timestamps.length === 0 && bucket.tokens === 0) this.buckets.delete(key);
    }
  }
}

export const rateLimiter = new MemoryRateLimiter();
setInterval(() => rateLimiter.cleanup(), 5 * 60_000);

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();
  if (!config.rate_limit.enabled) return next();

  try {
    rateLimiter.check(req.ip || "unknown", config.rate_limit.requests_per_minute, config.rate_limit.tokens_per_minute, config.rate_limit.concurrency);
  } catch (err) {
    return next(err);
  }

  rateLimiter.record(req.ip || "unknown");
  res.on("finish", () => rateLimiter.release());

  next();
}
