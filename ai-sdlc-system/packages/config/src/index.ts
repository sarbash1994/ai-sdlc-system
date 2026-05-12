import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  openaiApiKey: z.string().min(1),
  openaiModel: z.string().default("gpt-4.1-mini"),
  telegramBotToken: z.string().optional(),
  telegramAllowedUserId: z.coerce.number().optional(),
  apiPort: z.coerce.number().default(3000),
  apiBaseUrl: z.string().url().default("http://localhost:3000"),
  redisUrl: z.string().url().default("redis://localhost:6379"),
  githubToken: z.string().optional(),
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
  githubDefaultBranch: z.string().default("main"),
  workerSandboxImage: z.string().default("node:20-bookworm")
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  return configSchema.parse({
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramAllowedUserId: process.env.TELEGRAM_ALLOWED_USER_ID,
    apiPort: process.env.API_PORT,
    apiBaseUrl: process.env.API_BASE_URL,
    redisUrl: process.env.REDIS_URL,
    githubToken: process.env.GITHUB_TOKEN,
    githubOwner: process.env.GITHUB_OWNER,
    githubRepo: process.env.GITHUB_REPO,
    githubDefaultBranch: process.env.GITHUB_DEFAULT_BRANCH,
    workerSandboxImage: process.env.WORKER_SANDBOX_IMAGE
  });
}
