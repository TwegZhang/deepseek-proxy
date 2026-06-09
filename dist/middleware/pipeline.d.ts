import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Config } from "../config/schema";
import type { Logger } from "../utils/logger";
import type { PluginEngine } from "../plugins/engine";
import type { LLMProvider } from "../providers/interface";
type ErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void;
export interface PipelineDeps {
    config: Config;
    logger: Logger;
    pluginEngine: PluginEngine;
    provider: LLMProvider;
}
export declare function buildMiddlewareStack(deps: PipelineDeps): {
    handlers: RequestHandler[];
    errorHandler: ErrorHandler;
};
export {};
//# sourceMappingURL=pipeline.d.ts.map