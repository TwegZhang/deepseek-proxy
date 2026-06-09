"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
exports.rateLimitMiddleware = rateLimitMiddleware;
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
const MAX_BUCKETS = 10_000;
class MemoryRateLimiter {
    buckets = new Map();
    concurrency = 0;
    check(key, maxRequests, maxConcurrency) {
        if (this.concurrency >= maxConcurrency) {
            throw new errors_1.RateLimitError("Too many concurrent requests");
        }
        let bucket = this.buckets.get(key);
        if (!bucket) {
            if (this.buckets.size >= MAX_BUCKETS) {
                // Evict oldest bucket to prevent unbounded growth
                const oldest = this.buckets.keys().next().value;
                if (oldest)
                    this.buckets.delete(oldest);
            }
            bucket = { timestamps: [] };
            this.buckets.set(key, bucket);
        }
        const now = Date.now();
        bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
        if (bucket.timestamps.length >= maxRequests) {
            throw new errors_1.RateLimitError("Request rate limit exceeded");
        }
    }
    record(key) {
        const bucket = this.buckets.get(key);
        if (bucket) {
            bucket.timestamps.push(Date.now());
        }
        this.concurrency++;
    }
    release() {
        this.concurrency = Math.max(0, this.concurrency - 1);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, bucket] of this.buckets) {
            bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
            if (bucket.timestamps.length === 0)
                this.buckets.delete(key);
        }
    }
}
exports.rateLimiter = new MemoryRateLimiter();
setInterval(() => exports.rateLimiter.cleanup(), 5 * 60_000);
function rateLimitMiddleware(req, res, next) {
    const config = (0, config_1.getConfig)();
    if (!config.rate_limit.enabled)
        return next();
    try {
        exports.rateLimiter.check(req.ip || "unknown", config.rate_limit.requests_per_minute, config.rate_limit.concurrency);
    }
    catch (err) {
        return next(err);
    }
    exports.rateLimiter.record(req.ip || "unknown");
    // Release on finish, close, or error — prevents concurrency leak on disconnects
    const release = () => exports.rateLimiter.release();
    res.on("finish", release);
    res.on("close", release);
    res.on("error", release);
    next();
}
//# sourceMappingURL=rateLimit.js.map