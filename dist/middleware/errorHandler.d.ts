import type { Request, Response, NextFunction } from "express";
import type { Logger } from "../utils/logger";
export declare function errorHandler(logger: Logger): (err: Error, _req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map