import { Worker } from "bullmq";
import { loadConfig } from "@ai-sdlc/config";
import { logger } from "@ai-sdlc/logger";
import { EmptyRetriever } from "@ai-sdlc/memory";
import {
  JsonFileTaskStore,
  PIPELINE_QUEUE_NAME,
  PipelineOrchestrator
} from "@ai-sdlc/orchestrator";
import { createPullRequestFromDiffs } from "@ai-sdlc/tools";
import { workerJobSchema } from "@ai-sdlc/types";

const config = loadConfig();
const taskStore = new JsonFileTaskStore("storage/tasks.json");
const orchestrator = new PipelineOrchestrator(config, taskStore, new EmptyRetriever());

const worker = new Worker(
  PIPELINE_QUEUE_NAME,
  async (job) => {
    const data = workerJobSchema.parse(job.data);

    if (data.kind === "run-pipeline") {
      const task = await orchestrator.runMvpPipeline(data.taskId);

      if (!task.backendDevOutput) {
        throw new Error("Backend dev output missing after pipeline run");
      }

      if (config.githubToken && config.githubOwner && config.githubRepo) {
        const result = await createPullRequestFromDiffs(
          {
            token: config.githubToken,
            owner: config.githubOwner,
            repo: config.githubRepo,
            defaultBranch: config.githubDefaultBranch
          },
          {
            taskId: task.id,
            idea: task.idea,
            devOutput: task.backendDevOutput
          }
        );
        await orchestrator.attachPullRequest(task.id, result.url);
      } else {
        logger.warn("GitHub env is incomplete; skipping PR creation");
      }

      return { taskId: task.id };
    }

    if (data.kind === "github-pr") {
      const task = await taskStore.getTask(data.taskId);
      if (!task) {
        throw new Error(`Task not found: ${data.taskId}`);
      }

      const result = await createPullRequestFromDiffs(
        {
          token: requireEnv("GITHUB_TOKEN", config.githubToken),
          owner: requireEnv("GITHUB_OWNER", config.githubOwner),
          repo: requireEnv("GITHUB_REPO", config.githubRepo),
          defaultBranch: config.githubDefaultBranch
        },
        {
          taskId: task.id,
          idea: task.idea,
          devOutput: data.devOutput
        }
      );
      await orchestrator.attachPullRequest(task.id, result.url);
      return result;
    }

    throw new Error("Unsupported job kind");
  },
  { connection: { url: config.redisUrl } }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "worker job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "worker job failed");
});

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

logger.info({ queue: PIPELINE_QUEUE_NAME }, "AI SDLC worker started");
