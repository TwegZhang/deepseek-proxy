"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const app_1 = require("./app");
const deepseek_1 = require("./providers/deepseek");
const engine_1 = require("./plugins/engine");
const vision_1 = require("./plugins/vision");
const search_1 = require("./plugins/search");
async function main() {
    const config = (0, config_1.loadConfig)();
    const logger = (0, logger_1.createLogger)(config.logging.level);
    logger.info("Starting deepseek-proxy...");
    const apiKey = config.providers.deepseek.api_key;
    if (!apiKey) {
        logger.error("DP_DEEPSEEK_API_KEY not set. Exiting.");
        process.exit(1);
    }
    const provider = new deepseek_1.DeepSeekProvider(logger, {
        base_url: config.providers.deepseek.base_url,
        api_key: apiKey,
        timeout_ms: config.providers.deepseek.timeout_ms,
    });
    const pluginEngine = new engine_1.PluginEngine(logger);
    const visionEnabled = process.env.DP_VISION_ENABLED !== undefined
        ? process.env.DP_VISION_ENABLED === "true"
        : config.plugins.vision.enabled;
    if (visionEnabled) {
        if (process.env.DP_VISION_BASE_URL && process.env.DP_VISION_API_KEY) {
            pluginEngine.register(new vision_1.VisionPlugin(logger));
        }
        else {
            logger.warn("Vision enabled but DP_VISION_BASE_URL or DP_VISION_API_KEY not set — skipping");
        }
    }
    const searchEnabled = process.env.DP_SEARCH_ENABLED !== undefined
        ? process.env.DP_SEARCH_ENABLED === "true"
        : config.plugins.search.enabled;
    if (searchEnabled) {
        if (process.env.DP_SEARCH_API_KEY) {
            pluginEngine.register(new search_1.SearchPlugin(logger));
        }
        else {
            logger.warn("Search enabled but DP_SEARCH_API_KEY not set — skipping");
        }
    }
    await pluginEngine.initializeAll();
    const app = (0, app_1.createApp)({ config, logger, provider, pluginEngine });
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
//# sourceMappingURL=index.js.map