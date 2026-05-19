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
      messageText: ctx.message && "text" in ctx.message ? ctx.message.text : undefined
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
  await ctx.reply(["Available MVP agents:", "- BA (Business Analyst)", "- PM (Product Manager)", "- Backend Developer", "- Frontend Developer", "- Mobile Developer", "- DevOps Engineer", "- QA Automation Engineer", "- QA Manual Engineer"].join("\n"));
});

async function createIdeaFromText(ctx: any, idea: string) {
  try {
    await ctx.reply(`Creating a task for your idea: "${idea}"...`);
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
    logger.error({ error: message }, "telegram idea creation failed");
    await ctx.reply(`Could not reach API at ${config.apiBaseUrl}: ${message}`);
  }
}

bot.command("idea", async (ctx) => {
  const idea = ctx.message.text.replace(/^\/idea(@\w+)?\s*/i, "").trim();
  if (!idea) {
    await ctx.reply("Send /idea followed by the task description.");
    return;
  }
  await createIdeaFromText(ctx, idea);
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

async function findActiveTaskWaitingForApproval(chatId: number): Promise<{ id: string } | null> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/tasks`);
    if (!response.ok) return null;
    const tasks = (await response.json()) as any[];
    const matchingTasks = tasks
      .filter(t => t.telegramChatId === chatId && t.status === "waiting_for_approval")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return matchingTasks[0] || null;
  } catch {
    return null;
  }
}

async function submitAnswers(ctx: any, taskId: string, answers: string) {
  try {
    await ctx.reply(`Submitting answers for task ${taskId}...`);
    const response = await fetch(`${config.apiBaseUrl}/tasks/${encodeURIComponent(taskId)}/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers })
    });

    if (!response.ok) {
      await ctx.reply(`Could not submit answers: ${await response.text()}`);
      return;
    }

    await ctx.reply(`Answers received for task ${taskId}. Re-starting pipeline!`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "telegram submitAnswers failed");
    await ctx.reply(`Error submitting answers: ${message}`);
  }
}

bot.command("answer", async (ctx) => {
  const text = ctx.message.text.replace(/^\/answer(@\w+)?\s*/i, "").trim();
  if (!text) {
    await ctx.reply("Please provide answers after the command, e.g.: /answer My response here...");
    return;
  }

  const activeTask = await findActiveTaskWaitingForApproval(ctx.chat.id);
  if (!activeTask) {
    await ctx.reply("No task is currently waiting for clarifying answers in this chat.");
    return;
  }

  await submitAnswers(ctx, activeTask.id, text);
});

bot.command("approve", async (ctx) => {
  const activeTask = await findActiveTaskWaitingForApproval(ctx.chat.id);
  if (!activeTask) {
    await ctx.reply("No task is currently waiting for approval in this chat.");
    return;
  }

  try {
    await ctx.reply(`Approving task ${activeTask.id}...`);
    const response = await fetch(`${config.apiBaseUrl}/tasks/${encodeURIComponent(activeTask.id)}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" }
    });

    if (!response.ok) {
      await ctx.reply(`Could not approve task: ${await response.text()}`);
      return;
    }

    await ctx.reply(`Task ${activeTask.id} approved! Continuing to the next stage...`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "telegram approve failed");
    await ctx.reply(`Error approving task: ${message}`);
  }
});

bot.on("message", async (ctx, next) => {
  if (ctx.message && "text" in ctx.message) {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) {
      return next();
    }

    const activeTask = await findActiveTaskWaitingForApproval(ctx.chat.id);
    if (activeTask) {
      await submitAnswers(ctx, activeTask.id, text);
      return;
    }

    // If no active task is waiting for approval, treat this message as a new idea directly!
    if (text.length >= 3) {
      await createIdeaFromText(ctx, text);
      return;
    }
  }
  await next();
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
