import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["OPENAI_API_KEY", "GITHUB_TOKEN", "TELEGRAM_BOT_TOKEN"]
});

export type Logger = typeof logger;
