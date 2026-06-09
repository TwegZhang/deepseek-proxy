import { Router } from "express";
import type { Logger } from "../utils/logger";
import type { LLMProvider } from "../providers/interface";
import type { PluginEngine } from "../plugins/engine";
import type { Config } from "../config/schema";
import { createMessagesRouter } from "./v1/messages";

export function createRoutes(deps: {
  config: Config;
  logger: Logger;
  provider: LLMProvider;
  pluginEngine: PluginEngine;
}): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const health = await deps.provider.healthCheck();
    res.json({
      status: health.ok ? "ok" : "degraded",
      provider: { ok: health.ok, latency_ms: health.latency },
      plugins: deps.pluginEngine.getPlugins().map((p) => ({ id: p.id, name: p.name })),
    });
  });

  router.use("/v1", createMessagesRouter(deps));
  return router;
}
