import type { Logger } from "./utils/logger";
import type { LLMProvider } from "./providers/interface";
import type { PluginEngine } from "./plugins/engine";
import type { Config } from "./config/schema";
export declare function createApp(deps: {
    config: Config;
    logger: Logger;
    provider: LLMProvider;
    pluginEngine: PluginEngine;
}): import("express-serve-static-core").Express;
//# sourceMappingURL=app.d.ts.map