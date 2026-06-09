"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelTranslateMiddleware = modelTranslateMiddleware;
exports.reverseTranslateModel = reverseTranslateModel;
const config_1 = require("../config");
const context_1 = require("./context");
function modelTranslateMiddleware(req, _res, next) {
    const body = req.body;
    if (!body?.model)
        return next();
    const config = (0, config_1.getConfig)();
    const mapping = config.model_mapping[body.model] || config.model_mapping["default"];
    if (mapping) {
        (0, context_1.setOriginalModel)(req, body.model);
        body.model = mapping.model;
    }
    next();
}
function reverseTranslateModel(providerModel) {
    const config = (0, config_1.getConfig)();
    for (const [anthropicName, mapping] of Object.entries(config.model_mapping)) {
        if (mapping.model === providerModel)
            return anthropicName;
    }
    return providerModel;
}
//# sourceMappingURL=modelTranslate.js.map