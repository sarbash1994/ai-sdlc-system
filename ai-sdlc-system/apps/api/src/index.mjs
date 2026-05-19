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

    if (request.method === "POST" && url.pathname.startsWith("/tasks/") && url.pathname.endsWith("/answers")) {
      const parts = url.pathname.split("/");
      if (parts.length === 4 && parts[1] === "tasks" && parts[3] === "answers") {
        const taskId = decodeURIComponent(parts[2]);
        const body = await readRequestJson(request);
        const answers = typeof body.answers === "string" ? body.answers.trim() : "";
        if (!answers) {
          sendJson(response, 400, { error: "answers must not be empty" });
          return;
        }

        const tasks = await readJsonArray(taskPath);
        const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId);
        if (taskIndex === -1) {
          sendJson(response, 404, { error: "Task not found" });
          return;
        }

        const task = tasks[taskIndex];
        task.updatedAt = new Date().toISOString();
        if (task.currentStage === "ARCHITECTURE_COMMITTEE") {
          const committeeMsg = {
            agent: "Customer",
            message: answers,
            vote: "discuss"
          };
          task.committeeDiscussion = task.committeeDiscussion || [];
          task.committeeDiscussion.push(committeeMsg);
          task.status = "queued";
          task.stages = task.stages.map((record) => {
            if (record.name === "ARCHITECTURE_COMMITTEE") {
              return { ...record, status: "queued" };
            }
            return record;
          });
          task.logs.push(`${task.updatedAt} Customer feedback received, resuming ARCHITECTURE_COMMITTEE`);
        } else {
          if (task.clarifyingAnswers) {
            task.clarifyingAnswers = `${task.clarifyingAnswers}\nUser feedback: ${answers}`;
          } else {
            task.clarifyingAnswers = answers;
          }
          task.status = "queued";
          task.stages = task.stages.map((record) => {
            if (record.name === "BA_ANALYSIS") {
              return { ...record, status: "queued" };
            }
            return record;
          });
          task.logs.push(`${task.updatedAt} Clarifying answers/feedback received, re-queueing BA_ANALYSIS`);
        }

        await writeJsonArray(taskPath, tasks);
        await enqueueJob("run-pipeline", { kind: "run-pipeline", taskId: task.id });
        sendJson(response, 200, task);
        return;
      }
    }

    if (request.method === "POST" && url.pathname.startsWith("/tasks/") && url.pathname.endsWith("/approve")) {
      const parts = url.pathname.split("/");
      if (parts.length === 4 && parts[1] === "tasks" && parts[3] === "approve") {
        const taskId = decodeURIComponent(parts[2]);
        const tasks = await readJsonArray(taskPath);
        const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId);
        if (taskIndex === -1) {
          sendJson(response, 404, { error: "Task not found" });
          return;
        }

        const task = tasks[taskIndex];
        const now = new Date().toISOString();
        
        task.status = "done";
        task.updatedAt = now;
        task.stages = task.stages.map((record) => {
          if (record.name === task.currentStage) {
            return {
              ...record,
              status: "done",
              finishedAt: now
            };
          }
          return record;
        });
        task.logs.push(`${now} Approved stage ${task.currentStage}, marking as done`);

        await writeJsonArray(taskPath, tasks);
        await enqueueJob("run-pipeline", { kind: "run-pipeline", taskId: task.id });
        sendJson(response, 200, task);
        return;
      }
    }
    if (request.method === "POST" && url.pathname.startsWith("/tasks/") && url.pathname.endsWith("/revise")) {
      const parts = url.pathname.split("/");
      if (parts.length === 4 && parts[1] === "tasks" && parts[3] === "revise") {
        const taskId = decodeURIComponent(parts[2]);
        const tasks = await readJsonArray(taskPath);
        const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId);
        if (taskIndex === -1) {
          sendJson(response, 404, { error: "Task not found" });
          return;
        }

        const task = tasks[taskIndex];
        const now = new Date().toISOString();
        
        task.currentStage = "PM_PLANNING";
        task.status = "queued";
        task.updatedAt = now;
        task.stages = task.stages.map((record) => {
          if (record.name === "PM_PLANNING" || record.name === "ARCHITECTURE_COMMITTEE") {
            return {
              ...record,
              status: "queued"
            };
          }
          return record;
        });
        task.logs.push(`${now} Committee requested plan revision, rewinding to PM_PLANNING`);

        await writeJsonArray(taskPath, tasks);
        await enqueueJob("run-pipeline", { kind: "run-pipeline", taskId: task.id });
        sendJson(response, 200, task);
        return;
      }
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
