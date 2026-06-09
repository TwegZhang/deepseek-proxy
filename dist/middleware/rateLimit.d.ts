import type { Request, Response, NextFunction } from "express";
declare class MemoryRateLimiter {
    private buckets;
    private concurrency;
    check(key: string, maxRequests: number, maxConcurrency: number): void;
    record(key: string): void;
    release(): void;
    cleanup(): void;
}
export declare const rateLimiter: MemoryRateLimiter;
export declare function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void;
export {};
//# sourceMappingURL=rateLimit.d.ts.map