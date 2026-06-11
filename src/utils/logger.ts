import pino from "pino";
import fs from "fs";
import path from "path";

export function createLogger(level: string = "info") {
  const logFile = process.env.DP_LOG_FILE;
  if (logFile) {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return pino(
      { level },
      pino.multistream([
        { stream: process.stdout },
        { stream: pino.destination(logFile) },
      ])
    );
  }

  return pino({
    level,
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

export type Logger = pino.Logger;
