import { Router, type RequestHandler } from "express";
import type { Logger } from "../../utils/logger";
import type { LLMProvider } from "../../providers/interface";
import type { PluginEngine } from "../../plugins/engine";
import type { Config } from "../../config/schema";
import { buildMiddlewareStack } from "../../middleware/pipeline";

export function createMessagesRouter(deps: {
  config: Config;
  logger: Logger;
  provider: LLMProvider;
  pluginEngine: PluginEngine;
}): Router {
  const router = Router();
  const { handlers, errorHandler } = buildMiddlewareStack(deps);
  router.post("/messages", ...handlers, errorHandler as unknown as RequestHandler);
  return router;
}
