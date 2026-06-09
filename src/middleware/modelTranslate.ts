import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config";
import { setOriginalModel } from "./context";

export function modelTranslateMiddleware(req: Request, _res: Response, next: NextFunction) {
  const body = req.body;
  if (!body?.model) return next();

  const config = getConfig();
  const mapping = config.model_mapping[body.model] || config.model_mapping["default"];
  if (mapping) {
    setOriginalModel(req, body.model);
    body.model = mapping.model;
  }
  next();
}

export function reverseTranslateModel(providerModel: string): string {
  const config = getConfig();
  for (const [anthropicName, mapping] of Object.entries(config.model_mapping)) {
    if (mapping.model === providerModel) return anthropicName;
  }
  return providerModel;
}
