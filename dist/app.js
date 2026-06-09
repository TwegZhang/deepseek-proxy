"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const routes_1 = require("./routes");
const errorHandler_1 = require("./middleware/errorHandler");
function createApp(deps) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "32mb" }));
    app.use((req, _res, next) => {
        deps.logger.info({ method: req.method, path: req.path }, "request");
        next();
    });
    app.use((0, routes_1.createRoutes)(deps));
    app.use((0, errorHandler_1.errorHandler)(deps.logger));
    return app;
}
//# sourceMappingURL=app.js.map