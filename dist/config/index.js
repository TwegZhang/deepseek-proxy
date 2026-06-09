"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.getConfig = getConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const dotenv_1 = __importDefault(require("dotenv"));
const schema_1 = require("./schema");
const default_1 = require("./default");
const errors_1 = require("../utils/errors");
dotenv_1.default.config();
function loadYamlConfig() {
    const configPath = process.env.DP_CONFIG_PATH || path_1.default.resolve(process.cwd(), "config", "default.yaml");
    try {
        const raw = fs_1.default.readFileSync(configPath, "utf-8");
        return js_yaml_1.default.load(raw) || {};
    }
    catch {
        return {};
    }
}
function applyEnvOverrides(raw) {
    const m = { ...raw };
    const setNested = (path, key, val) => {
        const parts = path.split(".");
        let obj = m;
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (!obj[p] || typeof obj[p] !== "object")
                obj[p] = {};
            if (i === parts.length - 1)
                obj[p][key] = val;
            else
                obj = obj[p];
        }
    };
    if (process.env.DP_DEEPSEEK_API_KEY)
        setNested("providers.deepseek", "api_key", process.env.DP_DEEPSEEK_API_KEY);
    if (process.env.DP_DEEPSEEK_BASE_URL)
        setNested("providers.deepseek", "base_url", process.env.DP_DEEPSEEK_BASE_URL);
    if (process.env.DP_PROXY_API_KEY)
        setNested("auth", "proxy_key", process.env.DP_PROXY_API_KEY);
    if (process.env.LOG_LEVEL)
        setNested("logging", "level", process.env.LOG_LEVEL);
    if (process.env.PORT)
        setNested("server", "port", parseInt(process.env.PORT, 10));
    return m;
}
function deepMerge(base, override) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
        const ov = override[key];
        const bv = result[key];
        if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object" && !Array.isArray(bv)) {
            result[key] = deepMerge(bv, ov);
        }
        else if (ov !== undefined) {
            result[key] = ov;
        }
    }
    return result;
}
let _config = null;
function loadConfig() {
    if (_config)
        return _config;
    const yamlRaw = loadYamlConfig();
    const withEnv = applyEnvOverrides(yamlRaw);
    const merged = deepMerge(default_1.defaultConfig, withEnv);
    const result = schema_1.ConfigSchema.safeParse(merged);
    if (!result.success) {
        const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new errors_1.ConfigurationError(`Invalid configuration: ${messages}`);
    }
    _config = result.data;
    return _config;
}
function getConfig() {
    if (!_config)
        return loadConfig();
    return _config;
}
//# sourceMappingURL=index.js.map