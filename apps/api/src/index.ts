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

app.get("/health/detailed", async (_request, response) => {
  try {
    // Get uptime in readable format
    const uptimeSeconds = process.uptime();
    const uptime = new Date(uptimeSeconds * 1000).toISOString().substr(11, 8); // HH:MM:SS

    // Get number of running agents - assuming agents are tasks with status 'running'
    const tasks = await taskStore.listTasks();
    const runningAgentsCount = tasks.filter(task => task.status === 'running').length;

    // Get DB connection status
    let dbStatus = "unknown";
    try {
      // Simulate checking DB connection status, here we can do a simple operation like listing tasks to check connectivity
      await taskStore.listTasks();
      dbStatus = "3F3E343A3B4E47353D3E";
    } catch (dbError) {
      dbStatus = `3E4838313A30: ${(dbError instanceof Error) ? dbError.message : String(dbError)}`;
    }

    response.json({
      uptime,
      runningAgentsCount,
      dbStatus
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
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
