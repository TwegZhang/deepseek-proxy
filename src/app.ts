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
    if (req.method === "POST" && req.path === "/v1/messages") {
      const body = req.body as Record<string, unknown>;
      const messages = body?.messages as Array<{ role: string; content: unknown }> | undefined;
      deps.logger.info({
        model: body?.model,
        stream: body?.stream,
        msgCount: messages?.length,
        msgSummary: messages?.map((m) => ({
          role: m.role,
          contentType: Array.isArray(m.content)
            ? (m.content as Array<Record<string, unknown>>).map((c) => ({ type: c.type, hasSource: !!c.source, hasImageUrl: !!c.image_url, textLen: typeof c.text === "string" ? c.text.length : 0, keys: Object.keys(c).slice(0, 8) }))
            : typeof m.content === "string" ? `text(${(m.content as string).length})` : typeof m.content,
        })),
      }, "messages body");
    }
    next();
  });

  app.use(createRoutes(deps));
  app.use(errorHandler(deps.logger));
  return app;
}
