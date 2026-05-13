import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  sdlcTaskSchema,
  type PipelineStage,
  type SDLCTask,
  type TaskStatus
} from "@ai-sdlc/types";
import { createTaskId, nowIso } from "@ai-sdlc/utils";
import { mvpPipelineStages } from "@ai-sdlc/workflows";

export interface TaskStore {
  createTask(input: { idea: string; telegramChatId?: number }): Promise<SDLCTask>;
  getTask(taskId: string): Promise<SDLCTask | undefined>;
  listTasks(): Promise<SDLCTask[]>;
  saveTask(task: SDLCTask): Promise<void>;
}

export class JsonFileTaskStore implements TaskStore {
  constructor(private readonly path: string) {}

  async createTask(input: { idea: string; telegramChatId?: number }): Promise<SDLCTask> {
    const timestamp = nowIso();
    const task: SDLCTask = {
      id: createTaskId(),
      idea: input.idea,
      status: "queued",
      currentStage: "IDEA",
      stages: mvpPipelineStages.map((name) => ({
        name,
        status: name === "IDEA" ? "done" : "queued",
        attempts: 0,
        ...(name === "IDEA" ? { startedAt: timestamp, finishedAt: timestamp } : {})
      })),
      logs: [`${timestamp} IDEA received`],
      executions: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      telegramChatId: input.telegramChatId
    };

    const tasks = await this.readAll();
    tasks.push(task);
    await this.writeAll(tasks);
    return task;
  }

  async getTask(taskId: string): Promise<SDLCTask | undefined> {
    return (await this.readAll()).find((task) => task.id === taskId);
  }

  async listTasks(): Promise<SDLCTask[]> {
    return this.readAll();
  }

  async saveTask(task: SDLCTask): Promise<void> {
    const tasks = await this.readAll();
    const index = tasks.findIndex((candidate) => candidate.id === task.id);
    const updatedTask = { ...task, updatedAt: nowIso() };
    if (index === -1) {
      tasks.push(updatedTask);
    } else {
      tasks[index] = updatedTask;
    }

    await this.writeAll(tasks);
  }

  private async readAll(): Promise<SDLCTask[]> {
    try {
      const content = await readFile(this.path, "utf8");
      if (!content.trim()) return [];
      return sdlcTaskSchema.array().parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      return []; // Return empty on parse error
    }
  }

  private async writeAll(tasks: SDLCTask[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  }
}

export function setStage(task: SDLCTask, stage: PipelineStage, status: TaskStatus): SDLCTask {
  const timestamp = nowIso();
  return {
    ...task,
    currentStage: stage,
    status,
    stages: task.stages.map((record) => {
      if (record.name !== stage) {
        return record;
      }

      return {
        ...record,
        status,
        attempts: status === "running" ? record.attempts + 1 : record.attempts,
        startedAt: status === "running" ? timestamp : record.startedAt,
        finishedAt: ["done", "failed"].includes(status) ? timestamp : record.finishedAt
      };
    }),
    logs: [...task.logs, `${timestamp} ${stage} ${status}`],
    updatedAt: timestamp
  };
}
