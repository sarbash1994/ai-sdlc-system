import { loadConfig } from "@ai-sdlc/config";
import { logger } from "@ai-sdlc/logger";
import { EmptyRetriever } from "@ai-sdlc/memory";
import {
  claimNextLocalJob,
  completeLocalJob,
  failLocalJob,
  recoverStuckJobs,
  JsonFileTaskStore,
  PIPELINE_QUEUE_NAME,
  PipelineOrchestrator
} from "@ai-sdlc/orchestrator";
import { createPullRequestFromDiffs } from "@ai-sdlc/tools";
import { workerJobSchema } from "@ai-sdlc/types";
import "./queues/pipeline.queue.js";
const config = loadConfig();
const taskStore = new JsonFileTaskStore("storage/tasks.json");
const orchestrator = new PipelineOrchestrator(config, taskStore, new EmptyRetriever());

async function processQueue(): Promise<void> {
  const job = await claimNextLocalJob();
  if (!job) {
    return;
  }

  try {
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

      await completeLocalJob(job.id);
      logger.info({ jobId: job.id, taskId: task.id }, "worker job completed");
      return;
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
      await completeLocalJob(job.id);
      logger.info({ jobId: job.id, taskId: task.id }, "worker job completed");
      return;
    }

    throw new Error("Unsupported job kind");
  } catch (error) {
    await failLocalJob(job.id, error);
    logger.error({ jobId: job.id, error }, "worker job failed");
  }
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

console.log(`AI SDLC worker started: ${PIPELINE_QUEUE_NAME}`);
logger.info({ queue: PIPELINE_QUEUE_NAME }, "AI SDLC worker started");

const recovered = await recoverStuckJobs();
if (recovered > 0) {
  logger.warn({ count: recovered }, "recovered stuck processing jobs → re-queued");
}

setInterval(() => {
  processQueue().catch((error) => {
    logger.error({ error }, "worker polling failed");
  });
}, 2000);

await processQueue();
