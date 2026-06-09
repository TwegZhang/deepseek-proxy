import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import dotenv from "dotenv";
import { ConfigSchema, type Config } from "./schema";
import { defaultConfig } from "./default";
import { ConfigurationError } from "../utils/errors";

dotenv.config();

function loadYamlConfig(): Record<string, unknown> {
  const configPath = process.env.DP_CONFIG_PATH || path.resolve(process.cwd(), "config", "default.yaml");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return (yaml.load(raw) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const m = { ...raw } as Record<string, unknown>;

  const setNested = (path: string, key: string, val: unknown) => {
    const parts = path.split(".");
    let obj = m;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!obj[p] || typeof obj[p] !== "object") obj[p] = {} as Record<string, unknown>;
      if (i === parts.length - 1) (obj[p] as Record<string, unknown>)[key] = val;
      else obj = obj[p] as Record<string, unknown>;
    }
  };

  if (process.env.DP_DEEPSEEK_API_KEY) setNested("providers.deepseek", "api_key", process.env.DP_DEEPSEEK_API_KEY);
  if (process.env.DP_PROXY_API_KEY) setNested("auth", "proxy_key", process.env.DP_PROXY_API_KEY);
  if (process.env.LOG_LEVEL) setNested("logging", "level", process.env.LOG_LEVEL);
  if (process.env.PORT) setNested("server", "port", parseInt(process.env.PORT, 10));

  return m;
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override)) {
    const ov = (override as Record<string, unknown>)[key];
    const bv = (result as Record<string, unknown>)[key];
    if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        bv as Record<string, unknown>,
        ov as Record<string, unknown>
      );
    } else if (ov !== undefined) {
      (result as Record<string, unknown>)[key] = ov;
    }
  }
  return result as T;
}

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;
  const yamlRaw = loadYamlConfig();
  const withEnv = applyEnvOverrides(yamlRaw);
  const merged = deepMerge(defaultConfig as unknown as Record<string, unknown>, withEnv);
  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigurationError(`Invalid configuration: ${messages}`);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}
