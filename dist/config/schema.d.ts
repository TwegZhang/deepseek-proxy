import { z } from "zod";
export declare const ConfigSchema: z.ZodObject<{
    server: z.ZodObject<{
        port: z.ZodDefault<z.ZodNumber>;
        host: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        host: string;
    }, {
        port?: number | undefined;
        host?: string | undefined;
    }>;
    auth: z.ZodObject<{
        proxy_key: z.ZodOptional<z.ZodString>;
        keys: z.ZodDefault<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            key_hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            label: string;
            key_hash: string;
        }, {
            label: string;
            key_hash: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        keys: {
            label: string;
            key_hash: string;
        }[];
        proxy_key?: string | undefined;
    }, {
        keys?: {
            label: string;
            key_hash: string;
        }[] | undefined;
        proxy_key?: string | undefined;
    }>;
    model_mapping: z.ZodRecord<z.ZodString, z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        model: string;
        provider: string;
    }, {
        model: string;
        provider: string;
    }>>;
    rate_limit: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        requests_per_minute: z.ZodDefault<z.ZodNumber>;
        concurrency: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        requests_per_minute: number;
        concurrency: number;
    }, {
        enabled?: boolean | undefined;
        requests_per_minute?: number | undefined;
        concurrency?: number | undefined;
    }>;
    providers: z.ZodObject<{
        deepseek: z.ZodObject<{
            base_url: z.ZodDefault<z.ZodString>;
            api_key: z.ZodOptional<z.ZodString>;
            timeout_ms: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            base_url: string;
            timeout_ms: number;
            api_key?: string | undefined;
        }, {
            base_url?: string | undefined;
            api_key?: string | undefined;
            timeout_ms?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        deepseek: {
            base_url: string;
            timeout_ms: number;
            api_key?: string | undefined;
        };
    }, {
        deepseek: {
            base_url?: string | undefined;
            api_key?: string | undefined;
            timeout_ms?: number | undefined;
        };
    }>;
    plugins: z.ZodObject<{
        vision: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            model: z.ZodDefault<z.ZodString>;
            max_tokens: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            max_tokens: number;
            model: string;
        }, {
            enabled?: boolean | undefined;
            max_tokens?: number | undefined;
            model?: string | undefined;
        }>;
        search: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            provider: z.ZodDefault<z.ZodEnum<["tavily", "bocha", "brave"]>>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            provider: "tavily" | "bocha" | "brave";
        }, {
            enabled?: boolean | undefined;
            provider?: "tavily" | "bocha" | "brave" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        vision: {
            enabled: boolean;
            max_tokens: number;
            model: string;
        };
        search: {
            enabled: boolean;
            provider: "tavily" | "bocha" | "brave";
        };
    }, {
        vision: {
            enabled?: boolean | undefined;
            max_tokens?: number | undefined;
            model?: string | undefined;
        };
        search: {
            enabled?: boolean | undefined;
            provider?: "tavily" | "bocha" | "brave" | undefined;
        };
    }>;
    logging: z.ZodObject<{
        level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    }, "strip", z.ZodTypeAny, {
        level: "info" | "error" | "warn" | "debug";
    }, {
        level?: "info" | "error" | "warn" | "debug" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    server: {
        port: number;
        host: string;
    };
    auth: {
        keys: {
            label: string;
            key_hash: string;
        }[];
        proxy_key?: string | undefined;
    };
    model_mapping: Record<string, {
        model: string;
        provider: string;
    }>;
    rate_limit: {
        enabled: boolean;
        requests_per_minute: number;
        concurrency: number;
    };
    providers: {
        deepseek: {
            base_url: string;
            timeout_ms: number;
            api_key?: string | undefined;
        };
    };
    plugins: {
        vision: {
            enabled: boolean;
            max_tokens: number;
            model: string;
        };
        search: {
            enabled: boolean;
            provider: "tavily" | "bocha" | "brave";
        };
    };
    logging: {
        level: "info" | "error" | "warn" | "debug";
    };
}, {
    server: {
        port?: number | undefined;
        host?: string | undefined;
    };
    auth: {
        keys?: {
            label: string;
            key_hash: string;
        }[] | undefined;
        proxy_key?: string | undefined;
    };
    model_mapping: Record<string, {
        model: string;
        provider: string;
    }>;
    rate_limit: {
        enabled?: boolean | undefined;
        requests_per_minute?: number | undefined;
        concurrency?: number | undefined;
    };
    providers: {
        deepseek: {
            base_url?: string | undefined;
            api_key?: string | undefined;
            timeout_ms?: number | undefined;
        };
    };
    plugins: {
        vision: {
            enabled?: boolean | undefined;
            max_tokens?: number | undefined;
            model?: string | undefined;
        };
        search: {
            enabled?: boolean | undefined;
            provider?: "tavily" | "bocha" | "brave" | undefined;
        };
    };
    logging: {
        level?: "info" | "error" | "warn" | "debug" | undefined;
    };
}>;
export type Config = z.infer<typeof ConfigSchema>;
//# sourceMappingURL=schema.d.ts.map