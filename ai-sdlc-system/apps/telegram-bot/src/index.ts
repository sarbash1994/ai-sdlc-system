import { Telegraf } from "telegraf";
import { loadConfig } from "@ai-sdlc/config";
import { logger } from "@ai-sdlc/logger";

const config = loadConfig();

if (!config.telegramBotToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is required to start the Telegram bot");
}

const bot = new Telegraf(config.telegramBotToken);

bot.use(async (ctx, next) => {
  logger.info(
    {
      updateType: ctx.updateType,
      fromId: ctx.from?.id,
      chatId: ctx.chat?.id,
      messageText: "text" in (ctx.message ?? {}) ? ctx.message.text : undefined
    },
    "telegram update received"
  );

  if (
    config.telegramAllowedUserId &&
    ctx.from?.id !== config.telegramAllowedUserId
  ) {
    await ctx.reply("This bot is restricted to the configured owner.");
    return;
  }

  await next();
});

bot.start(async (ctx) => {
  await ctx.reply("AI SDLC MVP is ready. Use /idea <description>, /agents, or /status <taskId>.");
});

bot.command("agents", async (ctx) => {
  await ctx.reply(["Available MVP agents:", "- BA", "- PM", "- Backend Developer"].join("\n"));
});

bot.command("idea", async (ctx) => {
  const idea = ctx.message.text.replace(/^\/idea(@\w+)?\s*/i, "").trim();
  if (!idea) {
    await ctx.reply("Send /idea followed by the task description.");
    return;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/ideas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idea, telegramChatId: ctx.chat.id })
    });

    if (!response.ok) {
      await ctx.reply(`Could not create task: ${await response.text()}`);
      return;
    }

    const task = (await response.json()) as { id: string; status: string };
    await ctx.reply(`Task created: ${task.id}\nStatus: ${task.status}\nUse /status ${task.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "telegram idea command failed");
    await ctx.reply(`Could not reach API at ${config.apiBaseUrl}: ${message}`);
  }
});

bot.command("status", async (ctx) => {
  const taskId = ctx.message.text.replace(/^\/status(@\w+)?\s*/i, "").trim();
  if (!taskId) {
    await ctx.reply("Send /status followed by a task id.");
    return;
  }

  const response = await fetch(`${config.apiBaseUrl}/tasks/${taskId}`);
  if (!response.ok) {
    await ctx.reply(`Task not found: ${taskId}`);
    return;
  }

  const task = (await response.json()) as {
    id: string;
    status: string;
    currentStage: string;
    pullRequestUrl?: string;
  };
  await ctx.reply(
    [
      `Task: ${task.id}`,
      `Status: ${task.status}`,
      `Stage: ${task.currentStage}`,
      task.pullRequestUrl ? `PR: ${task.pullRequestUrl}` : undefined
    ]
      .filter(Boolean)
      .join("\n")
  );
});

bot.catch((error) => {
  logger.error({ error }, "telegram bot error");
});

const botInfo = await bot.telegram.getMe();
logger.info(
  {
    botId: botInfo.id,
    username: botInfo.username,
    allowedUserId: config.telegramAllowedUserId ?? null,
    apiBaseUrl: config.apiBaseUrl
  },
  "telegram bot identity verified"
);

await bot.launch();
console.log(`AI SDLC Telegram bot started: @${botInfo.username}`);
logger.info("AI SDLC Telegram bot started");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
