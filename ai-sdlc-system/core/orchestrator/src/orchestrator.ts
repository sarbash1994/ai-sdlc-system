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
    console.log(`[Orchestrator] runMvpPipeline for task ${task.id}: stage=${task.currentStage}, status=${task.status}`);
    
    // BA Stage
    if (task.currentStage === "IDEA" || (task.currentStage === "BA_ANALYSIS" && task.status !== "done")) {
      task = await this.runBA(task);
    }
    
    // PM Stage
    if ((task.currentStage === "BA_ANALYSIS" && task.status === "done") || (task.currentStage === "PM_PLANNING" && task.status !== "done")) {
      task = await this.runPM(task);
    }

    // Committee Stage
    if ((task.currentStage === "PM_PLANNING" && task.status === "done") || (task.currentStage === "ARCHITECTURE_COMMITTEE" && task.status !== "done")) {
      task = await this.runCommittee(task);
    }

    // Dev Stage
    if ((task.currentStage === "ARCHITECTURE_COMMITTEE" && task.status === "done") || (task.currentStage === "DEV_IMPLEMENTATION" && task.status !== "done")) {
      task = await this.runBackendDev(task);
    }
    // QA Stage
    if ((task.currentStage === "DEV_IMPLEMENTATION" && task.status === "done") || (task.currentStage === "QA_AUTOMATION" && task.status !== "done")) {
      task = await this.runQA(task);
    }
    
    if (task.currentStage === "QA_AUTOMATION" && task.status === "done") {
      task = setStage(task, "DONE", "done");
      await this.taskStore.saveTask(task);
      await this.notify(task);
    }
    
    return task;
  }

  async runBA(task: SDLCTask): Promise<SDLCTask> {
    console.log(`[Orchestrator] Running BA for task ${task.id}`);
    const { runBAAgent, runBAQuestionsAgent } = await import("../../agents/src/ba-agent.js");

    // 1. If we have clarifying answers, run the full BA agent
    if (task.clarifyingAnswers) {
      task = setStage(task, "BA_ANALYSIS", "running");
      await this.taskStore.saveTask(task);
      await this.notify(task);

      try {
        const baOutput = await runBAAgent({
          client: this.client,
          model: this.config.openaiModel,
          idea: task.idea,
          answers: task.clarifyingAnswers
        });

        task.baOutput = baOutput;
        task = setStage(task, "BA_ANALYSIS", "waiting_for_approval");
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

    // 2. If we do not have clarifying questions yet, generate them
    if (!task.clarifyingQuestions || task.clarifyingQuestions.length === 0) {
      task = setStage(task, "BA_ANALYSIS", "running");
      await this.taskStore.saveTask(task);
      await this.notify(task);

      try {
        const questionsResult = await runBAQuestionsAgent({
          client: this.client,
          model: this.config.openaiModel,
          idea: task.idea
        });

        task.clarifyingQuestions = questionsResult.questions;
        task = setStage(task, "BA_ANALYSIS", "waiting_for_approval");
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

    // 3. If questions are generated but no answers are received yet, keep in waiting_for_approval
    if (task.status !== "waiting_for_approval") {
      task = setStage(task, "BA_ANALYSIS", "waiting_for_approval");
      await this.taskStore.saveTask(task);
      await this.notify(task);
    }
    return task;
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
        baOutput: task.baOutput!
      });

      task.pmOutput = pmOutput;
      task = setStage(task, "PM_PLANNING", "waiting_for_approval");
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

  async runCommittee(task: SDLCTask): Promise<SDLCTask> {
    console.log(`[Orchestrator] Running Committee for task ${task.id}`);
    const { runCommitteeDebate } = await import("../../agents/src/committee-agent.js");
    
    if (!task.pmOutput) throw new Error("Missing PM output for Committee stage");

    // Start debate only if not already waiting for approval
    if (task.status !== "waiting_for_approval") {
      task = setStage(task, "ARCHITECTURE_COMMITTEE", "running");
      await this.taskStore.saveTask(task);
      await this.notify(task);
    }

    try {
      const debateResult = await runCommitteeDebate({
        client: this.client,
        model: this.config.openaiModel,
        task,
        telegramChatId: task.telegramChatId,
        telegramBotToken: this.config.telegramBotToken
      });

      task.committeeDiscussion = debateResult.discussion;
      
      if (debateResult.consensusReached) {
        task = setStage(task, "ARCHITECTURE_COMMITTEE", "done");
      } else {
        // Escalate to human
        task = setStage(task, "ARCHITECTURE_COMMITTEE", "waiting_for_approval");
      }
      
      await this.taskStore.saveTask(task);
      await this.notify(task);
      return task;
    } catch (error) {
      task = setStage(task, "ARCHITECTURE_COMMITTEE", "failed");
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

      const prDetails = await this.generateEnglishPRDetails(task.idea, backendTask.description);
      const branchName = `feature/${slugifyBranchPart(prDetails.branchSlug)}-${task.id.split('_').pop()}`;
      const devOutput = await runBackendDevAgent({
        client: this.client,
        model: this.config.openaiModel,
        task: backendTask,
        codeContext: formattedContext,
        branchHint: branchName
      });

      const { createPullRequestFromDiffs } = await import("../../tools/src/index.js");

      const prResult = await createPullRequestFromDiffs(
        {
          token: this.config.githubToken || "",
          owner: this.config.githubOwner || "",
          repo: this.config.githubRepo || "",
          defaultBranch: this.config.githubDefaultBranch
        },
        {
          taskId: task.id,
          idea: task.idea,
          devOutput: devOutput,
          prTitle: prDetails.title,
          prBody: prDetails.body
        }
      );

      task.pullRequestUrl = prResult.url;
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

  async runQA(task: SDLCTask): Promise<SDLCTask> {
    console.log(`[Orchestrator] Running QA for task ${task.id}`);
    const { runQAAgent } = await import("../../agents/src/qa-agent.js");
    const { formatRetrievedContext } = await import("../../memory/src/index.js");

    if (!task.backendDevOutput) {
      console.log("[Orchestrator] No backend output found, skipping QA");
      task = setStage(task, "QA_AUTOMATION", "done");
      await this.taskStore.saveTask(task);
      return task;
    }

    task = setStage(task, "QA_AUTOMATION", "running");
    await this.taskStore.saveTask(task);
    await this.notify(task);

    try {
      const context = await this.retriever.retrieve(task.idea + " write automated tests for these changes");
      const formattedContext = formatRetrievedContext(context);

      const qaOutput = await runQAAgent({
        client: this.client,
        model: this.config.openaiModel,
        task: task,
        codeContext: formattedContext
      });

      const { pushChangesToBranch } = await import("../../tools/src/index.js");
      
      if (task.backendDevOutput?.branch) {
         await pushChangesToBranch(
           {
             token: this.config.githubToken || "",
             owner: this.config.githubOwner || "",
             repo: this.config.githubRepo || "",
             defaultBranch: this.config.githubDefaultBranch
           },
           task.backendDevOutput.branch,
           qaOutput.changes,
           `AI SDLC QA: Added tests for ${task.id}`
         );
      }

      task.qaAutomationOutput = qaOutput;
      task.logs.push(`${nowIso()} QA Automation tests pushed to PR branch.`);
      task = setStage(task, "QA_AUTOMATION", "done");
      await this.taskStore.saveTask(task);
      await this.notify(task);
      return task;
    } catch (error) {
      console.error("[Orchestrator] QA Automation failed:", error);
      task = setStage(task, "QA_AUTOMATION", "failed");
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

  private async generateEnglishPRDetails(idea: string, taskDescription: string): Promise<{ title: string; branchSlug: string; body: string }> {
    const prompt = `You are a helper that translates development task information to English for GitHub.
Original task description/idea (in Russian):
"${idea}"

Subtask details (in Russian):
"${taskDescription}"

Please generate:
1. A clean, concise Pull Request Title in English (e.g. "feat: add user authentication flow").
2. A short URL/git-branch-friendly slug in English for this task (e.g. "add-user-auth").
3. A Pull Request Description/Body in English summarizing what this change will accomplish.

Return a JSON object:
{
  "title": "...",
  "branchSlug": "...",
  "body": "..."
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.openaiModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      return {
        title: parsed.title || "feat: implement backend task",
        branchSlug: parsed.branchSlug || "backend-task",
        body: parsed.body || "Implemented backend changes as specified."
      };
    } catch (error) {
      console.error("Failed to generate English PR details:", error);
      return {
        title: "feat: implement backend task",
        branchSlug: "backend-task",
        body: "Implemented backend changes as specified."
      };
    }
  }
}
