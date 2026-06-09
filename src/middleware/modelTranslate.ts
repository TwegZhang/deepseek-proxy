import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config";

const ORIGINAL_MODEL = Symbol("originalModel");

export function modelTranslateMiddleware(req: Request, _res: Response, next: NextFunction) {
  const body = req.body;
  if (!body?.model) return next();

  const config = getConfig();
  const mapping = config.model_mapping[body.model] || config.model_mapping["default"];
  if (mapping) {
    (req as unknown as Record<string, unknown>)[ORIGINAL_MODEL as unknown as string] = body.model;
    body.model = mapping.model;
  }
  next();
}

export function getOriginalModel(req: Request): string | undefined {
  return (req as unknown as Record<string, unknown>)[ORIGINAL_MODEL as unknown as string] as string | undefined;
}

export function reverseTranslateModel(providerModel: string): string {
  const config = getConfig();
  for (const [anthropicName, mapping] of Object.entries(config.model_mapping)) {
    if (mapping.model === providerModel) return anthropicName;
  }
  return providerModel;
}
