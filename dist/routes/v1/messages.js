"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessagesRouter = createMessagesRouter;
const express_1 = require("express");
const pipeline_1 = require("../../middleware/pipeline");
function createMessagesRouter(deps) {
    const router = (0, express_1.Router)();
    const { handlers, errorHandler } = (0, pipeline_1.buildMiddlewareStack)(deps);
    router.post("/messages", ...handlers, errorHandler);
    return router;
}
//# sourceMappingURL=messages.js.map