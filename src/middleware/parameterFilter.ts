import type { Request, Response, NextFunction } from "express";

const UNSUPPORTED_PARAMS = ["top_k", "cache_control", "citations", "service_tier", "mcp_servers", "container"];
const UNSUPPORTED_CONTENT = ["image", "document", "search_result", "container_upload", "redacted_thinking"];

export function parameterFilterMiddleware(req: Request, _res: Response, next: NextFunction) {
  const body = req.body;
  if (!body) return next();

  const warnings: string[] = [];

  for (const param of UNSUPPORTED_PARAMS) {
    if (param in body) { delete body[param]; warnings.push(`${param} stripped`); }
  }

  if (body.thinking && typeof body.thinking === "object" && "budget_tokens" in body.thinking) {
    warnings.push("thinking.budget_tokens is ignored by upstream");
  }

  if (body.messages && Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.filter((block: Record<string, unknown>) => {
          if (typeof block === "object" && block !== null && typeof block.type === "string" && UNSUPPORTED_CONTENT.includes(block.type)) {
            warnings.push(`content block "${block.type}" stripped`);
            return false;
          }
          return true;
        });
      }
    }
  }

  if (warnings.length > 0) (req as unknown as Record<string, unknown>)._proxyWarnings = warnings;
  next();
}
