import type { Request, Response, NextFunction } from "express";
import type { Logger } from "../utils/logger";
import { ProxyError } from "../utils/errors";

export function errorHandler(logger: Logger) {
  return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ProxyError) {
      logger.warn({ code: err.code, status: err.statusCode }, err.message);
      res.status(err.statusCode).json(err.toJSON());
      return;
    }
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: { type: "internal_error", message: "An internal error occurred" } });
  };
}
