import fs from "fs";
import https from "https";
import { loadConfig } from "./config";
import { createLogger } from "./utils/logger";
import { createApp } from "./app";
import { DeepSeekProvider } from "./providers/deepseek";
import { PluginEngine } from "./plugins/engine";
import { VisionPlugin } from "./plugins/vision";
import { SearchPlugin } from "./plugins/search";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logging.level);

  logger.info("Starting deepseek-proxy...");

  const apiKey = config.providers.deepseek.api_key;
  if (!apiKey) {
    logger.error("DP_DEEPSEEK_API_KEY not set. Exiting.");
    process.exit(1);
  }

  const provider = new DeepSeekProvider(logger, {
    base_url: config.providers.deepseek.base_url,
    api_key: apiKey,
    timeout_ms: config.providers.deepseek.timeout_ms,
  });

  const pluginEngine = new PluginEngine(logger);

  const visionEnabled = process.env.DP_VISION_ENABLED !== undefined
    ? process.env.DP_VISION_ENABLED === "true"
    : config.plugins.vision.enabled;

  if (visionEnabled) {
    if (process.env.DP_VISION_BASE_URL && process.env.DP_VISION_API_KEY) {
      pluginEngine.register(new VisionPlugin(logger));
    } else {
      logger.warn("Vision enabled but DP_VISION_BASE_URL or DP_VISION_API_KEY not set — skipping");
    }
  }

  const searchEnabled = process.env.DP_SEARCH_ENABLED !== undefined
    ? process.env.DP_SEARCH_ENABLED === "true"
    : config.plugins.search.enabled;

  if (searchEnabled) {
    if (process.env.DP_SEARCH_API_KEY) {
      pluginEngine.register(new SearchPlugin(logger));
    } else {
      logger.warn("Search enabled but DP_SEARCH_API_KEY not set — skipping");
    }
  }

  await pluginEngine.initializeAll();

  const app = createApp({ config, logger, provider, pluginEngine });

  const { port, host } = config.server;

  // HTTPS mode: DP_HTTPS_CERT + DP_HTTPS_KEY env vars
  const certPath = process.env.DP_HTTPS_CERT;
  const keyPath = process.env.DP_HTTPS_KEY;

  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    https.createServer({ cert, key }, app).listen(port, host, () => {
      logger.info({ port, host, certPath }, "deepseek-proxy ready (HTTPS)");
      logger.info({ models: Object.keys(config.model_mapping) }, "Model mapping active");
    });
  } else {
    app.listen(port, host, () => {
      logger.info({ port, host }, "deepseek-proxy ready (HTTP)");
      logger.info({ models: Object.keys(config.model_mapping) }, "Model mapping active");
    });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
