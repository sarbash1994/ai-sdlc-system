import express from "express";
import { loadConfig } from "@ai-sdlc/config";
import { logger } from "@ai-sdlc/logger";
import { createPipelineQueue, JsonFileTaskStore } from "@ai-sdlc/orchestrator";
import { createIdeaInputSchema } from "@ai-sdlc/types";

const config = loadConfig();
const app = express();
const taskStore = new JsonFileTaskStore("storage/tasks.json");
const queue = createPipelineQueue(config.redisUrl);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/ideas", async (request, response, next) => {
  try {
    const input = createIdeaInputSchema.parse(request.body);
    const task = await taskStore.createTask(input);
    await queue.add("run-pipeline", { kind: "run-pipeline", taskId: task.id });
    response.status(202).json(task);
  } catch (error) {
    next(error);
  }
});

app.get("/tasks", async (_request, response, next) => {
  try {
    response.json(await taskStore.listTasks());
  } catch (error) {
    next(error);
  }
});

app.get("/tasks/:taskId", async (request, response, next) => {
  try {
    const task = await taskStore.getTask(request.params.taskId);
    if (!task) {
      response.status(404).json({ error: "Task not found" });
      return;
    }

    response.json(task);
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error({ error }, "api request failed");
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
);

app.listen(config.apiPort, () => {
  logger.info({ port: config.apiPort }, "AI SDLC API started");
});
