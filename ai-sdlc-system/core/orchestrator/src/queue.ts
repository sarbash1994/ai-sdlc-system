import { Queue } from "bullmq";
import type { WorkerJob } from "@ai-sdlc/types";

export const PIPELINE_QUEUE_NAME = "ai-sdlc-pipeline";

export function createPipelineQueue(redisUrl: string): Queue<WorkerJob> {
  return new Queue<WorkerJob>(PIPELINE_QUEUE_NAME, {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000
      },
      removeOnComplete: 100,
      removeOnFail: 250
    }
  });
}
