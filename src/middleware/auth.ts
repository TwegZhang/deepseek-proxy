import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { getConfig } from "../config";
import { AuthError } from "../utils/errors";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const config = getConfig();
  const proxyKey = (config.auth as Record<string, unknown>).proxy_key as string | undefined;
  const keys = config.auth.keys;

  if (!proxyKey && keys.length === 0) return next();

  const apiKey = (req.headers["x-api-key"] as string)?.trim();
  if (!apiKey) return next(new AuthError("Missing x-api-key header"));

  if (proxyKey) {
    if (apiKey === proxyKey) return next();
    return next(new AuthError("Invalid API key"));
  }

  for (const keyDef of keys) {
    if (bcrypt.compareSync(apiKey, keyDef.key_hash)) return next();
  }
  next(new AuthError("Invalid API key"));
}
