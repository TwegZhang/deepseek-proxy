import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { errorHandler } from "../../src/middleware/errorHandler";
import { AuthError, RateLimitError, ProviderError } from "../../src/utils/errors";
import type { Logger } from "../../src/utils/logger";

const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: () => logger as Logger } as unknown as Logger;

describe("errorHandler", () => {
  const h = errorHandler(logger);

  it("AuthError → 401", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    h(new AuthError("x"), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("RateLimitError → 429", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    h(new RateLimitError(), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("ProviderError → its status", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    h(new ProviderError("x", 503), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("generic Error → 500", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    h(new Error("x"), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
