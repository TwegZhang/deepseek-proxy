import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { getConfig } from "../config";
import { AuthError } from "../utils/errors";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const config = getConfig();
  const proxyKey = config.auth.proxy_key;
  const keys = config.auth.keys;

  if (!proxyKey && keys.length === 0) return next();

  const apiKey = (req.headers["x-api-key"] as string)?.trim();
  if (!apiKey) return next(new AuthError("Missing x-api-key header"));

  // Single-key mode — simple string compare, no bcrypt needed
  if (proxyKey) {
    if (apiKey === proxyKey) return next();
    return next(new AuthError("Invalid API key"));
  }

  // Multi-key mode — async bcrypt compare
  Promise.all(keys.map((k) => bcrypt.compare(apiKey, k.key_hash)))
    .then((results) => {
      if (results.some(Boolean)) return next();
      next(new AuthError("Invalid API key"));
    })
    .catch(next);
}
