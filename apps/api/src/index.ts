console.log("AI SDLC API boot: starting imports");

const [{ default: express }, { loadConfig }, { logger }, { createIdeaInputSchema }] =
  await Promise.all([
    import("express"),
    import("@ai-sdlc/config"),
    import("@ai-sdlc/logger"),
    import("@ai-sdlc/types")
  ]);

console.log("AI SDLC API boot: base imports loaded");

const [{ JsonFileTaskStore, createPipelineQueue }] = await Promise.all([
  import("@ai-sdlc/orchestrator")
]);

console.log("AI SDLC API boot: queue/store imports loaded");

const config = loadConfig();
const app = express();
const taskStore = new JsonFileTaskStore("storage/tasks.json");
const localQueue = createPipelineQueue("");   // uses storage/jobs.json

app.use(express.json({ limit: "1mb" }));

// Logging middleware for all requests
app.use((request, response, next) => {
  const start = process.hrtime();

  // Listening for the finish event on response to log info after response sent
  response.on('finish', () => {
    const diff = process.hrtime(start);
    let durationMs: number | string;
    if (diff) {
      durationMs = Math.round(diff[0] * 1000 + diff[1] / 1000000);
    } else {
      durationMs = 'unavailable';
    }

    // Get client IP address heuristically
    let ip = request.ip || request.connection?.remoteAddress || 'unknown';

    // Ensure IP is string and not empty
    if (!ip || typeof ip !== 'string') {
      ip = 'unknown';
    }

    // Compose log object
    const logObj = {
      url: request.originalUrl || request.url || 'unknown',
      method: request.method || 'unknown',
      ip,
      responseTimeMs: durationMs
    };

    logger.info(logObj, "http request");
    // Also output to console as JSON
    // Using try-catch to avoid any unexpected errors
    try {
      console.log(JSON.stringify(logObj));
    } catch {
      // ignore
    }
  });

  next();
});

app.use((request, _response, next) => {
  logger.info(
    { method: request.method, path: request.path },
    "api request received"
  );
  next();
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/ideas", async (request, response, next) => {
  try {
    const input = createIdeaInputSchema.parse(request.body);

    const task = await taskStore.createTask({
      idea: input.idea,
      telegramChatId: input.telegramChatId
    });
    await localQueue.add("run-pipeline", { kind: "run-pipeline", taskId: task.id });

    logger.info({ taskId: task.id }, "task queued for pipeline");
    response.status(202).json({ id: task.id, status: task.status });
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

app.use((request, response) => {
  response.status(404).json({
    error: "Route not found",
    method: request.method,
    path: request.path
  });
});

app.use(
  (
    error: unknown,
    _request: import("express").Request,
    response: import("express").Response,
    _next: import("express").NextFunction
  ) => {
    logger.error({ error }, "api request failed");
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
);

app.listen(config.apiPort, () => {
  console.log(`AI SDLC API started on port ${config.apiPort}`);
  logger.info({ port: config.apiPort }, "AI SDLC API started");
});
