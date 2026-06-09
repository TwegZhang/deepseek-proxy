"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setProviderRequest = setProviderRequest;
exports.getProviderRequest = getProviderRequest;
exports.setProviderResponse = setProviderResponse;
exports.getProviderResponse = getProviderResponse;
exports.setAnthropicResponse = setAnthropicResponse;
exports.getAnthropicResponse = getAnthropicResponse;
exports.setOriginalModel = setOriginalModel;
exports.getOriginalModel = getOriginalModel;
exports.setProxyWarnings = setProxyWarnings;
exports.getProxyWarnings = getProxyWarnings;
const store = new WeakMap();
function get(req) {
    let s = store.get(req);
    if (!s) {
        s = {};
        store.set(req, s);
    }
    return s;
}
function setProviderRequest(req, v) { get(req)._providerRequest = v; }
function getProviderRequest(req) { return get(req)._providerRequest; }
function setProviderResponse(req, v) { get(req)._providerResponse = v; }
function getProviderResponse(req) { return get(req)._providerResponse; }
function setAnthropicResponse(req, v) { get(req)._anthropicResponse = v; }
function getAnthropicResponse(req) { return get(req)._anthropicResponse; }
function setOriginalModel(req, model) { get(req)._originalModel = model; }
function getOriginalModel(req) { return get(req)._originalModel; }
function setProxyWarnings(req, warnings) { get(req)._proxyWarnings = warnings; }
function getProxyWarnings(req) { return get(req)._proxyWarnings; }
//# sourceMappingURL=context.js.map