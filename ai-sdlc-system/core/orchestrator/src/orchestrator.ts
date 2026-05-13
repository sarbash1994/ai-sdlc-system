import OpenAI from "openai";
import type { AppConfig } from "../../../packages/config/src/index.js";
import type { Retriever } from "../../memory/src/index.js";
import type { SDLCTask } from "../../../packages/types/src/index.js";
import { setStage, type TaskStore } from "./task-store.js";
import { nowIso, slugifyBranchPart } from "../../../packages/utils/src/index.js";

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

  addListener(listener: TaskListener) {
    this.listeners.push(listener);
  }

  private async notify(task: SDLCTask) {
    for (const listener of this.listeners) {
      await listener(task).catch(err => console.error("[Orchestrator] Listener error:", err));
    }
  }

  private async requireTask(taskId: string): Promise<SDLCTask> {
    const task = await this.taskStore.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    return task;
  }

  async runMvpPipeline(taskId: string): Promise<SDLCTask> {
    let task = await this.requireTask(taskId);
    
    // BA Stage
    if (task.currentStage === "IDEA" || (task.currentStage === "BA_ANALYSIS" && task.status !== "done")) {
      task = await this.runBA(task);
    }
    
    // PM Stage
    if (task.currentStage === "BA_ANALYSIS" && task.status === "done") {
      task = await this.runPM(task);
    }

    // Dev Stage
    if (task.currentStage === "PM_PLANNING" && task.status === "done") {
      task = await this.runBackendDev(task);
    }
    
    if (task.currentStage === "DEV_IMPLEMENTATION" && task.status === "done") {
      task = setStage(task, "DONE", "done");
      await this.taskStore.saveTask(task);
      await this.notify(task);
    }
    
    return task;
  }

  async runBA(task: SDLCTask): Promise<SDLCTask> {
    console.log(`[Orchestrator] Running BA for task ${task.id}`);
    const { runBAAgent } = await import("../../agents/src/ba-agent.js");
    
    task = setStage(task, "BA_ANALYSIS", "running");
    await this.taskStore.saveTask(task);
    await this.notify(task);

    try {
      const baOutput = await runBAAgent({
        client: this.client,
        model: this.config.openaiModel,
        idea: task.idea
      });

      task.baOutput = baOutput;
      task = setStage(task, "BA_ANALYSIS", "done");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      return task;
    } catch (error) {
      task = setStage(task, "BA_ANALYSIS", "failed");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      throw error;
    }
  }

  async runPM(task: SDLCTask): Promise<SDLCTask> {
    console.log(`[Orchestrator] Running PM for task ${task.id}`);
    const { runPMAgent } = await import("../../agents/src/index.js");
    
    if (!task.baOutput) throw new Error("Missing BA output for PM stage");

    task = setStage(task, "PM_PLANNING", "running");
    await this.taskStore.saveTask(task);
    await this.notify(task);

    try {
      const pmOutput = await runPMAgent({
        client: this.client,
        model: this.config.openaiModel,
        baOutput: task.baOutput
      });

      task.pmOutput = pmOutput;
      task = setStage(task, "PM_PLANNING", "done");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      return task;
    } catch (error) {
      task = setStage(task, "PM_PLANNING", "failed");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      throw error;
    }
  }

  async runBackendDev(task: SDLCTask): Promise<SDLCTask> {
    console.log(`[Orchestrator] Running BackendDev for task ${task.id}`);
    const { runBackendDevAgent } = await import("../../agents/src/backend-dev-agent.js");
    const { formatRetrievedContext } = await import("../../memory/src/index.js");

    if (!task.pmOutput) throw new Error("Missing PM output for Dev stage");

    const backendTask = task.pmOutput.tasks.find(t => t.type === "backend");
    if (!backendTask) {
      console.log("[Orchestrator] No backend task found, skipping Dev stage");
      task = setStage(task, "DEV_IMPLEMENTATION", "done");
      await this.taskStore.saveTask(task);
      return task;
    }

    task = setStage(task, "DEV_IMPLEMENTATION", "running");
    await this.taskStore.saveTask(task);
    await this.notify(task);

    try {
      const context = await this.retriever.retrieve(backendTask.description);
      const formattedContext = formatRetrievedContext(context);

      const titleForBranch = backendTask.title || "backend-task";
      const branchName = `feature/${slugifyBranchPart(String(titleForBranch))}-${task.id.split('_').pop()}`;
      const devOutput = await runBackendDevAgent({
        client: this.client,
        model: this.config.openaiModel,
        task: backendTask,
        context: formattedContext,
        branch: branchName
      });

      const { createPullRequestFromDiffs } = await import("../../tools/src/index.js");

      const prUrl = await createPullRequestFromDiffs({
        token: this.config.githubToken || "",
        owner: this.config.githubOwner || "",
        repo: this.config.githubRepo || "",
        title: backendTask.title || `Task ${backendTask.id}`,
        body: backendTask.description,
        branch: branchName,
        base: this.config.githubDefaultBranch,
        changes: devOutput.changes.map(c => ({
            path: c.file,
            content: c.diff // Note: Assuming the tool handles diff-to-content or we need full content
        }))
      });

      task.pullRequestUrl = prUrl;
      task.backendDevOutput = devOutput;
      task = setStage(task, "DEV_IMPLEMENTATION", "done");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      return task;
    } catch (error) {
      console.error("[Orchestrator] Backend Dev failed:", error);
      task = setStage(task, "DEV_IMPLEMENTATION", "failed");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      throw error;
    }
  }

  async attachPullRequest(taskId: string, pullRequestUrl: string): Promise<SDLCTask> {
    const task = await this.requireTask(taskId);
    task.pullRequestUrl = pullRequestUrl;
    task.logs.push(`${nowIso()} GitHub PR created: ${pullRequestUrl}`);
    await this.taskStore.saveTask(task);
    return task;
  }
}
