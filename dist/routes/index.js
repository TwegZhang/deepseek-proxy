"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutes = createRoutes;
const express_1 = require("express");
const messages_1 = require("./v1/messages");
function createRoutes(deps) {
    const router = (0, express_1.Router)();
    router.get("/health", async (_req, res) => {
        const health = await deps.provider.healthCheck();
        res.json({
            status: health.ok ? "ok" : "degraded",
            provider: { ok: health.ok, latency_ms: health.latency },
            plugins: deps.pluginEngine.getPlugins().map((p) => ({ id: p.id, name: p.name })),
        });
    });
    router.use("/v1", (0, messages_1.createMessagesRouter)(deps));
    return router;
}
//# sourceMappingURL=index.js.map