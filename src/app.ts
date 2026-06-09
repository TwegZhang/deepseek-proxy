import express from "express";
import type { Logger } from "./utils/logger";
import type { LLMProvider } from "./providers/interface";
import type { PluginEngine } from "./plugins/engine";
import type { Config } from "./config/schema";
import { createRoutes } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp(deps: {
  config: Config;
  logger: Logger;
  provider: LLMProvider;
  pluginEngine: PluginEngine;
}) {
  const app = express();
  app.use(express.json({ limit: "32mb" }));

  app.use((req, _res, next) => {
    deps.logger.info({ method: req.method, path: req.path }, "request");
    next();
  });

  app.use(createRoutes(deps));
  app.use(errorHandler(deps.logger));
  return app;
}
