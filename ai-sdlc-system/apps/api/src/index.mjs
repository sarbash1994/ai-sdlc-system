import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname } from "node:path";

loadEnvFile(".env.local");
loadEnvFile(".env");

const apiPort = Number(process.env.API_PORT || 3000);
const taskPath = "storage/tasks.json";
const jobPath = "storage/jobs.json";

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    console.log(`AI SDLC API request: ${request.method} ${url.pathname}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/ideas") {
      const body = await readRequestJson(request);
      const idea = typeof body.idea === "string" ? body.idea.trim() : "";
      if (idea.length < 3) {
        sendJson(response, 400, { error: "idea must contain at least 3 characters" });
        return;
      }

      const task = await createTask({
        idea,
        telegramChatId:
          typeof body.telegramChatId === "number" ? body.telegramChatId : undefined
      });
      await enqueueJob("run-pipeline", { kind: "run-pipeline", taskId: task.id });
      sendJson(response, 202, task);
      return;
    }

    if (request.method === "GET" && url.pathname === "/tasks") {
      sendJson(response, 200, await readJsonArray(taskPath));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/tasks/")) {
      const taskId = decodeURIComponent(url.pathname.slice("/tasks/".length));
      const tasks = await readJsonArray(taskPath);
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task) {
        sendJson(response, 404, { error: "Task not found" });
        return;
      }

      sendJson(response, 200, task);
      return;
    }

    sendJson(response, 404, {
      error: "Route not found",
      method: request.method,
      path: url.pathname
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI SDLC API error:", message);
    sendJson(response, 500, { error: message });
  }
});

server.on("error", (error) => {
  console.error(`AI SDLC API failed to start: ${error.message}`);
  process.exitCode = 1;
});

server.listen(apiPort, "127.0.0.1", () => {
  console.log(`AI SDLC API started on http://127.0.0.1:${apiPort}`);
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function createTask(input) {
  const now = new Date().toISOString();
  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    idea: input.idea,
    status: "queued",
    currentStage: "IDEA",
    stages: ["IDEA", "BA_ANALYSIS", "PM_PLANNING", "DEV_IMPLEMENTATION", "DONE"].map(
      (name) => ({
        name,
        status: name === "IDEA" ? "done" : "queued",
        attempts: 0,
        ...(name === "IDEA" ? { startedAt: now, finishedAt: now } : {})
      })
    ),
    logs: [`${now} IDEA received`],
    executions: [],
    createdAt: now,
    updatedAt: now,
    telegramChatId: input.telegramChatId
  };

  const tasks = await readJsonArray(taskPath);
  tasks.push(task);
  await writeJsonArray(taskPath, tasks);
  return task;
}

async function enqueueJob(name, data) {
  const now = new Date().toISOString();
  const jobs = await readJsonArray(jobPath);
  jobs.push({
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    data,
    status: "queued",
    attempts: 0,
    createdAt: now,
    updatedAt: now
  });
  await writeJsonArray(jobPath, jobs);
}

async function readJsonArray(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeJsonArray(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path);
    for (const line of raw.toString("utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}
