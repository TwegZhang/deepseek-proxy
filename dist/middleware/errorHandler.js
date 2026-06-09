"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../utils/errors");
function errorHandler(logger) {
    return (err, _req, res, _next) => {
        if (err instanceof errors_1.ProxyError) {
            logger.warn({ code: err.code, status: err.statusCode }, err.message);
            res.status(err.statusCode).json(err.toJSON());
            return;
        }
        logger.error({ err }, "Unhandled error");
        res.status(500).json({ error: { type: "internal_error", message: "An internal error occurred" } });
    };
}
//# sourceMappingURL=errorHandler.js.map