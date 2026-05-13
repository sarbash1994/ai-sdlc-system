import OpenAI from "openai";
import { runBAAgent, runBackendDevAgent, runPMAgent } from "@ai-sdlc/agents";
import type { AppConfig } from "@ai-sdlc/config";
import { formatRetrievedContext, type Retriever } from "@ai-sdlc/memory";
import type { BackendDevOutput, SDLCTask } from "@ai-sdlc/types";
import { nowIso, slugifyBranchPart } from "@ai-sdlc/utils";
import { setStage, type TaskStore } from "./task-store.js";

export type TaskListener = (task: SDLCTask) => Promise<void>;

export class PipelineOrchestrator {
  private readonly client: OpenAI;
  private readonly listeners: TaskListener[] = [];

  constructor(
    private readonly config: AppConfig,
    private readonly taskStore: TaskStore,
    private readonly retriever: Retriever
  ) {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  addListener(listener: TaskListener): void {
    this.listeners.push(listener);
  }

  private async notify(task: SDLCTask): Promise<void> {
    await Promise.all(this.listeners.map(l => l(task).catch(err => console.error('Listener failed:', err))));
  }

  async runMvpPipeline(taskId: string): Promise<SDLCTask> {
    const task = await this.requireTask(taskId);
    
    const withBA = await this.runBA(task);
    const withPM = await this.runPM(withBA);
    const withBackend = await this.runBackendDev(withPM);
    
    const done = setStage(withBackend, "DONE", "done");
    await this.taskStore.saveTask(done);
    await this.notify(done);
    
    return done;
  }

  async attachPullRequest(taskId: string, pullRequestUrl: string): Promise<SDLCTask> {
    const task = await this.requireTask(taskId);
    const updated = {
      ...task,
      pullRequestUrl,
      logs: [...task.logs, `${nowIso()} GitHub PR created: ${pullRequestUrl}`]
    };
    await this.taskStore.saveTask(updated);
    return updated;
  }

  private async runBA(task: SDLCTask): Promise<SDLCTask> {
    const running = setStage(task, "BA_ANALYSIS", "running");
    await this.taskStore.saveTask(running);
    await this.notify(running);
    const output = await runBAAgent({
      client: this.client,
      model: this.config.openaiModel,
      idea: task.idea
    });

    const updated = setStage(
      {
        ...running,
        baOutput: output,
        executions: [
          ...running.executions,
          { agent: "ba.agent", input: task.idea, output, timestamp: nowIso() }
        ]
      },
      "BA_ANALYSIS",
      "done"
    );
    await this.taskStore.saveTask(updated);
    await this.notify(updated);
    return updated;
  }

  private async runPM(task: SDLCTask): Promise<SDLCTask> {
    if (!task.baOutput) {
      throw new Error("BA output is required before PM planning");
    }

    const running = setStage(task, "PM_PLANNING", "running");
    await this.taskStore.saveTask(running);
    await this.notify(running);
    const output = await runPMAgent({
      client: this.client,
      model: this.config.openaiModel,
      baOutput: task.baOutput
    });

    const updated = setStage(
      {
        ...running,
        pmOutput: output,
        executions: [
          ...running.executions,
          { agent: "pm.agent", input: task.baOutput, output, timestamp: nowIso() }
        ]
      },
      "PM_PLANNING",
      "done"
    );
    await this.taskStore.saveTask(updated);
    await this.notify(updated);
    return updated;
  }

  private async runBackendDev(task: SDLCTask): Promise<SDLCTask> {
    const backendTask = task.pmOutput?.tasks.find((candidate) => candidate.type === "backend");
    if (!backendTask) {
      throw new Error("MVP requires a backend task from PM output");
    }

    const running = setStage(task, "DEV_IMPLEMENTATION", "running");
    await this.taskStore.saveTask(running);
    await this.notify(running);
    const context = await this.retriever.retrieve(backendTask.description);
    const output: BackendDevOutput = await runBackendDevAgent({
      client: this.client,
      model: this.config.openaiModel,
      task: backendTask,
      codeContext: formatRetrievedContext(context),
      branchHint: `${slugifyBranchPart(backendTask.description)}-${task.id}`
    });

    const updated = setStage(
      {
        ...running,
        backendDevOutput: output,
        executions: [
          ...running.executions,
          { agent: "backend.agent", input: backendTask, output, timestamp: nowIso() }
        ]
      },
      "DEV_IMPLEMENTATION",
      "done"
    );
    await this.taskStore.saveTask(updated);
    await this.notify(updated);
    return updated;
  }

  private async requireTask(taskId: string): Promise<SDLCTask> {
    const task = await this.taskStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return task;
  }
}
