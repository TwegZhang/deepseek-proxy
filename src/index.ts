import { loadConfig } from "./config";
import { createLogger } from "./utils/logger";
import { createApp } from "./app";
import { DeepSeekProvider } from "./providers/deepseek";
import { PluginEngine } from "./plugins/engine";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logging.level);

  logger.info("Starting deepseek-proxy...");

  const dsConfig = config.providers.deepseek;
  const apiKey = (dsConfig as Record<string, unknown>).api_key as string;
  if (!apiKey) {
    logger.error("DP_DEEPSEEK_API_KEY not set. Exiting.");
    process.exit(1);
  }

  const provider = new DeepSeekProvider(logger, {
    base_url: dsConfig.base_url,
    api_key: apiKey,
    timeout_ms: dsConfig.timeout_ms,
  });

  const pluginEngine = new PluginEngine(logger);

  if (config.plugins.vision.enabled) {
    logger.warn("Vision plugin not yet implemented — skipping");
  }
  if (config.plugins.search.enabled) {
    logger.warn("Search plugin not yet implemented — skipping");
  }

  await pluginEngine.initializeAll();

  const app = createApp({ config, logger, provider, pluginEngine });

  const { port, host } = config.server;
  app.listen(port, host, () => {
    logger.info({ port, host }, "deepseek-proxy ready");
    logger.info({ models: Object.keys(config.model_mapping) }, "Model mapping active");
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
