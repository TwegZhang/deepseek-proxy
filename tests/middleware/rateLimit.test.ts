import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { rateLimitMiddleware, rateLimiter } from "../../src/middleware/rateLimit";

vi.mock("../../src/config", () => ({
  getConfig: () => ({
    rate_limit: { enabled: true, requests_per_minute: 5, concurrency: 3 },
  }),
}));

beforeEach(() => {
  rateLimiter.cleanup();
});

describe("rateLimitMiddleware", () => {
  let next: ReturnType<typeof vi.fn>;
  beforeEach(() => { next = vi.fn(); });

  it("allows requests under limit", () => {
    const req = { ip: "192.168.0.1" } as unknown as Request;
    const res = { on: vi.fn() } as unknown as Response;
    rateLimitMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("registers finish/close/error listeners", () => {
    const req = { ip: "192.168.0.2" } as unknown as Request;
    const res = { on: vi.fn() } as unknown as Response;
    rateLimitMiddleware(req, res, next);
    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
    expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));
    expect(res.on).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
