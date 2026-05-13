console.log("AI SDLC API boot: starting imports");

const [{ default: express }, { loadConfig }, { logger }, { createIdeaInputSchema }] =
  await Promise.all([
    import("express"),
    import("@ai-sdlc/config"),
    import("@ai-sdlc/logger"),
    import("@ai-sdlc/types")
  ]);

console.log("AI SDLC API boot: base imports loaded");

const [{ createPipelineQueue }, { JsonFileTaskStore }] = await Promise.all([
  import("../../../core/orchestrator/src/queue.js"),
  import("../../../core/orchestrator/src/task-store.js")
]);

console.log("AI SDLC API boot: queue/store imports loaded");

const config = loadConfig();
const app = express();
const taskStore = new JsonFileTaskStore("storage/tasks.json");
const queue = createPipelineQueue(config.redisUrl);

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
